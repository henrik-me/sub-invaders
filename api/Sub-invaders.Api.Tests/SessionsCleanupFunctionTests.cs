namespace SubInvaders.Api.Tests;

using System;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging.Abstractions;
using SubInvaders.Api;
using SubInvaders.Api.Common;
using SubInvaders.Api.Models;
using SubInvaders.Api.Storage;
using Xunit;

[Collection(FeatureFlagTestCollection.Name)]
public class SessionsCleanupFunctionTests
{
    private static FakeHttpRequestData NewRequest() =>
        new("POST", "http://localhost/api/admin/sessions-cleanup");

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
        var resp = await fn.Run(NewRequest());

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
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
        var resp = await fn.Run(NewRequest());

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Equal(cap, leaderboard.Count);
        var body = ((FakeHttpResponseData)resp).ReadBodyAs<SessionsCleanupFunction.CleanupResult>();
        Assert.NotNull(body);
        Assert.Equal("ok", body!.Status);
        Assert.Equal(25, body.LeaderboardRowsTrimmed);
    }

    [Fact]
    public async Task CS12_Cleanup_deletes_stale_daily_leaderboard_rows_and_reports_count()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var sessions = new FakeSessionsRepository();
        var leaderboard = new FakeLeaderboardRepository();
        var oldDaily = LeaderboardPartitions.DailyPartition(DateTimeOffset.UtcNow.AddDays(-31).ToString("yyyy-MM-dd"));
        await leaderboard.AddAsync(new LeaderboardEntity
        {
            RowKey = LeaderboardEntity.FormatRowKey(100, Guid.NewGuid()),
            Score = 100,
            FinishedAt = DateTimeOffset.UtcNow,
        }, oldDaily);

        var fn = new SessionsCleanupFunction(
            sessions,
            leaderboard,
            NullLogger<SessionsCleanupFunction>.Instance,
            new CleanupOptions { DailyLeaderboardRetentionDays = 30 });
        var resp = await fn.Run(NewRequest());

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = ((FakeHttpResponseData)resp).ReadBodyAs<SessionsCleanupFunction.CleanupResult>();
        Assert.NotNull(body);
        Assert.Equal(1, body!.DailyLeaderboardRowsDeleted);
        Assert.Equal(0, leaderboard.Count);
    }

}
