namespace SubInvaders.Api.Tests;

using System;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using SubInvaders.Api;
using SubInvaders.Api.Common;
using SubInvaders.Api.Models;
using SubInvaders.Api.Storage;
using Xunit;

[Collection(FeatureFlagTestCollection.Name)]
public class ScoreFunctionTests
{
    private static (ScoreFunction Fn, FakeSessionsRepository Sessions, FakeLeaderboardRepository Leaderboard, SessionEntity Session)
        Setup(int score = 500, double elapsedSeconds = 60, DateTimeOffset? serverNow = null, int maxScorePerSecond = 50, int dailyMultiplierCap = 4)
    {
        var sessions = new FakeSessionsRepository();
        var leaderboard = new FakeLeaderboardRepository();
        var now = serverNow ?? DateTimeOffset.Parse("2026-05-14T12:00:00Z");
        var startedAt = now - TimeSpan.FromSeconds(elapsedSeconds);
        var sessionId = Guid.NewGuid().ToString("D");
        var session = new SessionEntity
        {
            PartitionKey = SessionEntity.PartitionKeyFor(startedAt),
            RowKey = sessionId,
            Nonce = "deadbeef",
            StartedAt = startedAt,
        };
        sessions.Seed(session);
        var fn = new ScoreFunction(sessions, leaderboard, new ScoreOptions
        {
            MaxScorePerSecond = maxScorePerSecond,
            DailyScoreMultiplierCap = dailyMultiplierCap,
            UtcNow = () => now,
        });
        return (fn, sessions, leaderboard, session);
    }

    private static FakeHttpRequestData PostScore(string body) =>
        new FakeHttpRequestData("POST", "https://localhost/api/score", body);

    [Fact]
    public async Task Happy_path_records_leaderboard_row_and_consumes_session()
    {
        var (fn, sessions, leaderboard, session) = Setup(score: 500, elapsedSeconds: 60);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":500,\"finishedAt\":\"{finishedAt:o}\"}}";
        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Equal(1, leaderboard.Count);
        var allRows = await leaderboard.GetTopAsync(10);
        var row = Assert.Single(allRows);
        Assert.Equal(LeaderboardEntity.PartitionAll, row.PartitionKey);
        var stored = await sessions.GetAsync(session.PartitionKey, session.RowKey);
        Assert.True(stored!.Consumed);
    }

    [Fact]
    public async Task Daily_submit_flag_off_returns_403()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, null);
        var (fn, sessions, leaderboard, session) = Setup(score: 500, elapsedSeconds: 60);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":500,\"finishedAt\":\"{finishedAt:o}\",\"period\":\"daily\",\"utcDate\":\"2026-05-14\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        AssertError(resp, HttpStatusCode.Forbidden, "feature_disabled", "daily challenge is disabled");
        Assert.Equal(0, leaderboard.Count);
        var stored = await sessions.GetAsync(session.PartitionKey, session.RowKey);
        Assert.False(stored!.Consumed);
    }

    [Fact]
    public async Task Daily_submit_flag_on_valid_date_writes_daily_partition()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var (fn, sessions, leaderboard, session) = Setup(score: 500, elapsedSeconds: 60);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":500,\"finishedAt\":\"{finishedAt:o}\",\"period\":\"daily\",\"utcDate\":\"2026-05-14\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var dailyRows = await leaderboard.GetTopAsync(10, LeaderboardPartitions.DailyPartition("2026-05-14"));
        var row = Assert.Single(dailyRows);
        Assert.Equal(LeaderboardPartitions.DailyPartition("2026-05-14"), row.PartitionKey);
        Assert.Empty(await leaderboard.GetTopAsync(10));
        var stored = await sessions.GetAsync(session.PartitionKey, session.RowKey);
        Assert.True(stored!.Consumed);
    }

    [Fact]
    public async Task Daily_submit_flag_on_invalid_date_returns_400()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var (fn, sessions, leaderboard, session) = Setup(score: 500, elapsedSeconds: 60);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":500,\"finishedAt\":\"{finishedAt:o}\",\"period\":\"daily\",\"utcDate\":\"20260514\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        AssertError(resp, HttpStatusCode.BadRequest, "invalid_argument", "utcDate must be YYYY-MM-DD");
        Assert.Equal(0, leaderboard.Count);
        var stored = await sessions.GetAsync(session.PartitionKey, session.RowKey);
        Assert.False(stored!.Consumed);
    }

    [Fact]
    public async Task Replay_on_same_session_returns_409()
    {
        var (fn, _, leaderboard, session) = Setup();
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":500,\"finishedAt\":\"{finishedAt:o}\"}}";
        var first = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal(1, leaderboard.Count);
    }

    [Fact]
    public async Task Unknown_session_returns_404()
    {
        var (fn, _, _, _) = Setup();
        var unknownId = Guid.NewGuid().ToString("D");
        var finishedAt = DateTimeOffset.UtcNow;
        var body = $"{{\"sessionId\":\"{unknownId}\",\"score\":500,\"finishedAt\":\"{finishedAt:o}\"}}";
        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Too_short_duration_returns_400()
    {
        var (fn, _, _, session) = Setup(elapsedSeconds: 5);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(5);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":100,\"finishedAt\":\"{finishedAt:o}\"}}";
        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Implausible_score_returns_400()
    {
        var (fn, _, _, session) = Setup(elapsedSeconds: 60);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":99999,\"finishedAt\":\"{finishedAt:o}\"}}";
        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Extra_field_returns_400()
    {
        var (fn, _, _, session) = Setup();
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":500,\"finishedAt\":\"{finishedAt:o}\",\"extra\":\"nope\"}}";
        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Body_over_1kb_returns_413()
    {
        var (fn, _, _, session) = Setup();
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var padding = new string('x', 1500);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":500,\"finishedAt\":\"{finishedAt:o}\",\"_pad\":\"{padding}\"}}";
        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, resp.StatusCode);
    }

    [Fact]
    public async Task Invalid_uuid_returns_400()
    {
        var (fn, _, _, _) = Setup();
        var finishedAt = DateTimeOffset.UtcNow;
        var body = $"{{\"sessionId\":\"not-a-uuid\",\"score\":100,\"finishedAt\":\"{finishedAt:o}\"}}";
        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Negative_score_returns_400()
    {
        var (fn, _, _, session) = Setup();
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":-1,\"finishedAt\":\"{finishedAt:o}\"}}";
        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Invalid_finished_at_returns_400()
    {
        var (fn, _, _, session) = Setup();
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":100,\"finishedAt\":\"not-a-date\"}}";
        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Concurrent_submissions_for_same_session_yield_exactly_one_accept()
    {
        // Race two ScoreFunction.Run() calls against the same sessionId. The
        // FakeSessionsRepository locks per-entity inside TryConsumeAsync so we
        // simulate the ETag-conditional Replace semantics: exactly one wins
        // (200), the other gets 409, and only one leaderboard row is written.
        var (fn, _, leaderboard, session) = Setup(score: 500, elapsedSeconds: 60);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":500,\"finishedAt\":\"{finishedAt:o}\"}}";

        var taskA = Task.Run(async () => (FakeHttpResponseData)await fn.Run(PostScore(body)));
        var taskB = Task.Run(async () => (FakeHttpResponseData)await fn.Run(PostScore(body)));
        var results = await Task.WhenAll(taskA, taskB);

        var ok = results.Count(r => r.StatusCode == HttpStatusCode.OK);
        var conflict = results.Count(r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(1, ok);
        Assert.Equal(1, conflict);
        Assert.Equal(1, leaderboard.Count);
    }


    [Fact]
    public async Task CS12_Daily_boss_rush_score_over_all_time_cap_is_accepted_under_daily_cap()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var (fn, _, leaderboard, session) = Setup(elapsedSeconds: 60, maxScorePerSecond: 50, dailyMultiplierCap: 4);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":6000,\"finishedAt\":\"{finishedAt:o}\",\"period\":\"daily\",\"utcDate\":\"2026-05-14\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Single(await leaderboard.GetTopAsync(10, LeaderboardPartitions.DailyPartition("2026-05-14")));
    }

    [Fact]
    public async Task CS12_Daily_score_above_daily_cap_returns_400()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var (fn, _, leaderboard, session) = Setup(elapsedSeconds: 60, maxScorePerSecond: 50, dailyMultiplierCap: 4);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(60);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":12001,\"finishedAt\":\"{finishedAt:o}\",\"period\":\"daily\",\"utcDate\":\"2026-05-14\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        AssertError(resp, HttpStatusCode.BadRequest, "implausible_score", "score exceeds 200 per second cap");
        Assert.Equal(0, leaderboard.Count);
    }

    [Fact]
    public async Task CS12_Early_server_clock_submit_returns_stale_or_early()
    {
        var (fn, _, _, session) = Setup(elapsedSeconds: 9.5);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(10);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":100,\"finishedAt\":\"{finishedAt:o}\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        AssertError(resp, HttpStatusCode.BadRequest, "stale_or_early_submission", "submission must arrive between 10s and 900s after session start");
    }

    [Fact]
    public async Task CS12_Abandoned_server_clock_submit_returns_stale_or_early()
    {
        var (fn, _, _, session) = Setup(elapsedSeconds: 901);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(600);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":100,\"finishedAt\":\"{finishedAt:o}\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        AssertError(resp, HttpStatusCode.BadRequest, "stale_or_early_submission", "submission must arrive between 10s and 900s after session start");
    }

    [Fact]
    public async Task CS12_Forged_finishedAt_duration_clamps_cap_to_server_elapsed()
    {
        var (fn, _, leaderboard, session) = Setup(elapsedSeconds: 10);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(600);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":30000,\"finishedAt\":\"{finishedAt:o}\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        AssertError(resp, HttpStatusCode.BadRequest, "implausible_score", "score exceeds 50 per second cap");
        Assert.Equal(0, leaderboard.Count);
    }

    [Fact]
    public async Task CS12_Daily_cap_exact_boundary_is_accepted()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var (fn, _, _, session) = Setup(elapsedSeconds: 10, maxScorePerSecond: 50, dailyMultiplierCap: 4);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(10);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":2000,\"finishedAt\":\"{finishedAt:o}\",\"period\":\"daily\",\"utcDate\":\"2026-05-14\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task CS12_Daily_cap_one_above_boundary_is_rejected()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var (fn, _, _, session) = Setup(elapsedSeconds: 10, maxScorePerSecond: 50, dailyMultiplierCap: 4);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(10);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":2001,\"finishedAt\":\"{finishedAt:o}\",\"period\":\"daily\",\"utcDate\":\"2026-05-14\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        AssertError(resp, HttpStatusCode.BadRequest, "implausible_score", "score exceeds 200 per second cap");
    }

    [Fact]
    public async Task CS12_Daily_cap_under_min_game_seconds_rejects_before_cap_logic()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var (fn, _, _, session) = Setup(elapsedSeconds: 9);
        var finishedAt = session.StartedAt + TimeSpan.FromSeconds(10);
        var body = $"{{\"sessionId\":\"{session.RowKey}\",\"score\":99999,\"finishedAt\":\"{finishedAt:o}\",\"period\":\"daily\",\"utcDate\":\"2026-05-14\"}}";

        var resp = (FakeHttpResponseData)await fn.Run(PostScore(body));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal("stale_or_early_submission", resp.ReadBodyAs<JsonResponse.ErrorBody>()!.Error);
    }

    private static void AssertError(FakeHttpResponseData resp, HttpStatusCode status, string error, string message)
    {
        Assert.Equal(status, resp.StatusCode);
        var body = resp.ReadBodyAs<JsonResponse.ErrorBody>();
        Assert.NotNull(body);
        Assert.Equal(error, body!.Error);
        Assert.Equal(message, body.Message);
    }
}
