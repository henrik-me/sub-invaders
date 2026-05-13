namespace SubInvaders.Api;

using System;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using SubInvaders.Api.Storage;

public class SessionsCleanupFunction
{
    public const int LeaderboardCap = 10_000;
    public static readonly TimeSpan SessionTtl = TimeSpan.FromHours(24);

    private readonly ISessionsRepository _sessions;
    private readonly ILeaderboardRepository _leaderboard;
    private readonly ILogger<SessionsCleanupFunction> _logger;

    public SessionsCleanupFunction(
        ISessionsRepository sessions,
        ILeaderboardRepository leaderboard,
        ILogger<SessionsCleanupFunction> logger)
    {
        _sessions = sessions;
        _leaderboard = leaderboard;
        _logger = logger;
    }

    [Function("SessionsCleanup")]
    public async Task Run([TimerTrigger("0 0 * * * *")] TimerInfo timer)
    {
        var cutoff = DateTimeOffset.UtcNow - SessionTtl;
        _logger.LogInformation("SessionsCleanup: pass 1 — deleting Sessions older than {Cutoff:o}", cutoff);
        await _sessions.DeleteOlderThanAsync(cutoff).ConfigureAwait(false);

        _logger.LogInformation("SessionsCleanup: pass 2 — trimming Leaderboard to top {Cap}", LeaderboardCap);
        var trimmed = await _leaderboard.TrimAsync(LeaderboardCap).ConfigureAwait(false);
        _logger.LogInformation("SessionsCleanup: deleted {Trimmed} leaderboard rows beyond cap", trimmed);
    }
}
