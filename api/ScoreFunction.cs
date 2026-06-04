namespace SubInvaders.Api;

using System;
using System.Globalization;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using SubInvaders.Api.Common;
using SubInvaders.Api.Models;
using SubInvaders.Api.Storage;

public class ScoreFunction
{
    public const int MinGameSeconds = 10;
    public const int MaxGameSeconds = 600;
    public const int MaxSubmitSeconds = 900;

    private readonly ISessionsRepository _sessions;
    private readonly ILeaderboardRepository _leaderboard;
    private readonly int _maxScorePerSecond;
    private readonly int _dailyScoreMultiplierCap;
    private readonly Func<DateTimeOffset> _utcNow;

    public ScoreFunction(
        ISessionsRepository sessions,
        ILeaderboardRepository leaderboard,
        ScoreOptions options)
    {
        _sessions = sessions;
        _leaderboard = leaderboard;
        _maxScorePerSecond = options.MaxScorePerSecond;
        _dailyScoreMultiplierCap = options.DailyScoreMultiplierCap;
        _utcNow = options.UtcNow;
    }

    [Function("Score")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "score")] HttpRequestData req)
    {
        var serverNow = _utcNow();
        var (ok, body, error) = await RequestHelpers.ReadBodyBoundedAsync(req).ConfigureAwait(false);
        if (!ok)
        {
            return await JsonResponse.Error(req, HttpStatusCode.RequestEntityTooLarge, "payload_too_large", error ?? "request body too large").ConfigureAwait(false);
        }

        ScorePayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<ScorePayload>(body, StrictOptions);
        }
        catch (JsonException ex)
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "invalid_json", ex.Message).ConfigureAwait(false);
        }

        if (payload is null)
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "invalid_body", "request body is required").ConfigureAwait(false);
        }
        if (string.IsNullOrWhiteSpace(payload.SessionId) || !Guid.TryParse(payload.SessionId, out _))
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "invalid_session_id", "sessionId must be a UUID").ConfigureAwait(false);
        }
        if (payload.Score < 0 || payload.Score > LeaderboardEntity.MaxScore)
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "invalid_score", "score out of range").ConfigureAwait(false);
        }
        if (string.IsNullOrWhiteSpace(payload.FinishedAt) ||
            !DateTimeOffset.TryParse(payload.FinishedAt, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var finishedAt))
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "invalid_finished_at", "finishedAt must be ISO-8601").ConfigureAwait(false);
        }

        var period = string.IsNullOrWhiteSpace(payload.Period)
            ? "all"
            : payload.Period.ToLowerInvariant();
        var partitionKey = LeaderboardEntity.PartitionAll;
        if (period == "daily")
        {
            if (!FeatureFlags.IsDailyChallengeEnabled())
            {
                return await JsonResponse.Error(req, HttpStatusCode.Forbidden, "feature_disabled",
                    "daily challenge is disabled").ConfigureAwait(false);
            }
            if (!LeaderboardPartitions.IsUtcDate(payload.UtcDate))
            {
                return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "invalid_argument",
                    "utcDate must be YYYY-MM-DD").ConfigureAwait(false);
            }
            partitionKey = LeaderboardPartitions.DailyPartition(payload.UtcDate!);
        }
        else if (period != "all")
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "invalid_period",
                "period must be 'all' or 'daily'").ConfigureAwait(false);
        }

        var session = await _sessions.FindAcrossPartitionsAsync(payload.SessionId).ConfigureAwait(false);
        if (session is null)
        {
            return await JsonResponse.Error(req, HttpStatusCode.NotFound, "session_not_found", "session does not exist").ConfigureAwait(false);
        }
        if (session.Consumed)
        {
            return await JsonResponse.Error(req, HttpStatusCode.Conflict, "already_consumed", "session has already been used").ConfigureAwait(false);
        }

        var elapsed = finishedAt - session.StartedAt;
        if (elapsed.TotalSeconds < MinGameSeconds || elapsed.TotalSeconds > MaxGameSeconds)
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "invalid_duration",
                $"finishedAt - startedAt must be between {MinGameSeconds}s and {MaxGameSeconds}s").ConfigureAwait(false);
        }

        var serverElapsed = serverNow - session.StartedAt;
        if (serverElapsed.TotalSeconds < MinGameSeconds || serverElapsed.TotalSeconds > MaxSubmitSeconds)
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "stale_or_early_submission",
                $"submission must arrive between {MinGameSeconds}s and {MaxSubmitSeconds}s after session start").ConfigureAwait(false);
        }

        var effectiveElapsedSeconds = Math.Min(elapsed.TotalSeconds, serverElapsed.TotalSeconds);
        var multiplier = period == "daily" ? _dailyScoreMultiplierCap : 1;
        var effectiveScorePerSecondCap = _maxScorePerSecond * multiplier;
        var maxAllowed = (long)Math.Floor(effectiveElapsedSeconds * effectiveScorePerSecondCap);
        if (payload.Score > maxAllowed)
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "implausible_score",
                $"score exceeds {effectiveScorePerSecondCap} per second cap").ConfigureAwait(false);
        }

        var consumed = await _sessions.TryConsumeAsync(session).ConfigureAwait(false);
        if (!consumed)
        {
            return await JsonResponse.Error(req, HttpStatusCode.Conflict, "already_consumed", "session has already been used").ConfigureAwait(false);
        }

        var submissionId = Guid.NewGuid();
        var entity = new LeaderboardEntity
        {
            PartitionKey = partitionKey,
            RowKey = LeaderboardEntity.FormatRowKey(payload.Score, submissionId),
            Score = payload.Score,
            FinishedAt = finishedAt,
            SessionId = payload.SessionId,
        };
        await _leaderboard.AddAsync(entity, partitionKey).ConfigureAwait(false);

        return await JsonResponse.Write(req, HttpStatusCode.OK, new ScoreAck("accepted", payload.Score, submissionId.ToString("D"))).ConfigureAwait(false);
    }

    private static readonly JsonSerializerOptions StrictOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
    };

    public sealed class ScorePayload
    {
        public string? SessionId { get; set; }
        public int Score { get; set; }
        public string? FinishedAt { get; set; }
        public string? Period { get; set; }
        public string? UtcDate { get; set; }
    }

    public sealed record ScoreAck(string Status, int Score, string SubmissionId);
}

public sealed class ScoreOptions
{
    public int MaxScorePerSecond { get; init; } = 50;
    public int DailyScoreMultiplierCap { get; init; } = 4;
    public Func<DateTimeOffset> UtcNow { get; init; } = () => DateTimeOffset.UtcNow;
}
