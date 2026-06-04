namespace SubInvaders.Api;

using System;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using SubInvaders.Api.Common;
using SubInvaders.Api.Storage;

public class SessionsCleanupFunction
{
    public const int LeaderboardCap = 10_000;
    public static readonly TimeSpan SessionTtl = TimeSpan.FromHours(24);

    private readonly ISessionsRepository _sessions;
    private readonly ILeaderboardRepository _leaderboard;
    private readonly ILogger<SessionsCleanupFunction> _logger;
    private readonly int _dailyLeaderboardRetentionDays;

    public SessionsCleanupFunction(
        ISessionsRepository sessions,
        ILeaderboardRepository leaderboard,
        ILogger<SessionsCleanupFunction> logger,
        CleanupOptions? options = null)
    {
        _sessions = sessions;
        _leaderboard = leaderboard;
        _logger = logger;
        _dailyLeaderboardRetentionDays = options?.DailyLeaderboardRetentionDays ?? 30;
    }

    // SWA managed Functions does not support timerTrigger ('Currently, only
    // httpTriggers are supported.'). The cleanup is therefore exposed as an
    // admin-key-protected HTTP endpoint that is invoked on a schedule by an
    // external scheduler (GitHub Actions cron / Azure Logic App). The route
    // is intentionally not part of the public /api surface (no Route attr)
    // and AuthorizationLevel.Function requires a function key.
    [Function("SessionsCleanup")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "admin/sessions-cleanup")] HttpRequestData req)
    {
        var utcNow = DateTimeOffset.UtcNow;
        var cutoff = utcNow - SessionTtl;
        _logger.LogInformation("SessionsCleanup: pass 1 — deleting Sessions older than {Cutoff:o}", cutoff);
        await _sessions.DeleteOlderThanAsync(cutoff).ConfigureAwait(false);

        _logger.LogInformation("SessionsCleanup: pass 2 — trimming Leaderboard to top {Cap}", LeaderboardCap);
        var trimmed = await _leaderboard.TrimAsync(LeaderboardCap).ConfigureAwait(false);
        _logger.LogInformation("SessionsCleanup: deleted {Trimmed} leaderboard rows beyond cap", trimmed);

        _logger.LogInformation("SessionsCleanup: pass 3 — deleting daily Leaderboard partitions older than {RetentionDays} days", _dailyLeaderboardRetentionDays);
        var dailyDeleted = await _leaderboard.DeleteDailyPartitionsOlderThanAsync(_dailyLeaderboardRetentionDays, utcNow).ConfigureAwait(false);
        _logger.LogInformation("SessionsCleanup: deleted {DailyDeleted} stale daily leaderboard rows", dailyDeleted);

        return await JsonResponse.Write(req, HttpStatusCode.OK, new CleanupResult(
            "ok",
            cutoff.ToString("o"),
            trimmed,
            dailyDeleted)).ConfigureAwait(false);
    }

    public sealed record CleanupResult(string Status, string SessionsCutoff, int LeaderboardRowsTrimmed, int DailyLeaderboardRowsDeleted);
}

public sealed class CleanupOptions
{
    public int DailyLeaderboardRetentionDays { get; init; } = 30;
}
