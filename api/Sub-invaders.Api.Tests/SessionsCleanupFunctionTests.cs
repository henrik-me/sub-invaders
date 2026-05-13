namespace SubInvaders.Api.Tests;

using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging.Abstractions;
using SubInvaders.Api;
using SubInvaders.Api.Models;
using Xunit;

public class SessionsCleanupFunctionTests
{
    [Fact]
    public async Task Cleanup_deletes_sessions_older_than_24h()
    {
        var sessions = new FakeSessionsRepository();
        var leaderboard = new FakeLeaderboardRepository();
        var oldStarted = DateTimeOffset.UtcNow - TimeSpan.FromHours(48);
        var newStarted = DateTimeOffset.UtcNow - TimeSpan.FromHours(1);
        sessions.Seed(new SessionEntity { PartitionKey = SessionEntity.PartitionKeyFor(oldStarted), RowKey = "old", StartedAt = oldStarted });
        sessions.Seed(new SessionEntity { PartitionKey = SessionEntity.PartitionKeyFor(newStarted), RowKey = "new", StartedAt = newStarted });
        Assert.Equal(2, sessions.Count);

        var fn = new SessionsCleanupFunction(sessions, leaderboard, NullLogger<SessionsCleanupFunction>.Instance);
        await fn.Run(null!);

        Assert.Equal(1, sessions.Count);
        Assert.Null(await sessions.GetAsync(SessionEntity.PartitionKeyFor(oldStarted), "old"));
        Assert.NotNull(await sessions.GetAsync(SessionEntity.PartitionKeyFor(newStarted), "new"));
    }

    [Fact]
    public async Task Cleanup_trims_leaderboard_beyond_cap()
    {
        var sessions = new FakeSessionsRepository();
        var leaderboard = new FakeLeaderboardRepository();
        const int cap = SessionsCleanupFunction.LeaderboardCap;
        for (int i = 0; i < cap + 25; i++)
        {
            await leaderboard.AddAsync(new LeaderboardEntity
            {
                RowKey = LeaderboardEntity.FormatRowKey(cap + 25 - i, Guid.NewGuid()),
                Score = cap + 25 - i,
                FinishedAt = DateTimeOffset.UtcNow,
            });
        }
        Assert.Equal(cap + 25, leaderboard.Count);

        var fn = new SessionsCleanupFunction(sessions, leaderboard, NullLogger<SessionsCleanupFunction>.Instance);
        await fn.Run(null!);

        Assert.Equal(cap, leaderboard.Count);
    }
}
