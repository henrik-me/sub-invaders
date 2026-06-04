namespace SubInvaders.Api.Tests;

using System;
using System.Linq;
using System.Threading.Tasks;
using SubInvaders.Api.Common;
using SubInvaders.Api.Models;
using SubInvaders.Api.Storage;
using Xunit;

[Collection(FeatureFlagTestCollection.Name)]
public class LeaderboardRepositoryPartitionTests
{
    private static LeaderboardEntity Row(int score, string partitionKey = LeaderboardEntity.PartitionAll)
    {
        return new LeaderboardEntity
        {
            PartitionKey = partitionKey,
            RowKey = LeaderboardEntity.FormatRowKey(score, Guid.NewGuid()),
            Score = score,
            FinishedAt = DateTimeOffset.UtcNow,
            SessionId = Guid.NewGuid().ToString("D"),
        };
    }

    [Fact]
    public async Task AddAsync_default_partition_routes_to_all()
    {
        var leaderboard = new FakeLeaderboardRepository();
        var dailyPartition = LeaderboardPartitions.DailyPartition("2026-05-14");

        await leaderboard.AddAsync(Row(100, dailyPartition));

        var allRows = await leaderboard.GetTopAsync(10);
        var row = Assert.Single(allRows);
        Assert.Equal(LeaderboardEntity.PartitionAll, row.PartitionKey);
        Assert.Empty(await leaderboard.GetTopAsync(10, dailyPartition));
    }

    [Fact]
    public async Task Daily_partition_routing_reads_and_writes_only_that_partition()
    {
        var leaderboard = new FakeLeaderboardRepository();
        var dailyPartition = LeaderboardPartitions.DailyPartition("2026-05-14");

        await leaderboard.AddAsync(Row(500, dailyPartition), dailyPartition);
        await leaderboard.AddAsync(Row(900, dailyPartition), dailyPartition);
        await leaderboard.AddAsync(Row(700));

        var dailyRows = await leaderboard.GetTopAsync(10, dailyPartition);

        Assert.Equal(2, dailyRows.Count);
        Assert.All(dailyRows, row => Assert.Equal(dailyPartition, row.PartitionKey));
        Assert.Equal(new[] { 900, 500 }, dailyRows.Select(row => row.Score).ToArray());
    }

    [Fact]
    public async Task Cross_partition_writes_are_isolated()
    {
        var leaderboard = new FakeLeaderboardRepository();
        var dailyPartition = LeaderboardPartitions.DailyPartition("2026-05-14");

        await leaderboard.AddAsync(Row(900, dailyPartition), dailyPartition);
        await leaderboard.AddAsync(Row(100));

        var allRow = Assert.Single(await leaderboard.GetTopAsync(10));
        var dailyRow = Assert.Single(await leaderboard.GetTopAsync(10, dailyPartition));
        Assert.Equal(100, allRow.Score);
        Assert.Equal(900, dailyRow.Score);
    }

    [Fact]
    public async Task CS12_DeleteDailyPartitionsOlderThanAsync_deletes_old_daily_only()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var leaderboard = new FakeLeaderboardRepository();
        var utcNow = DateTimeOffset.Parse("2026-06-04T12:00:00Z");
        var oldDaily = LeaderboardPartitions.DailyPartition("2026-05-04");
        var recentDaily = LeaderboardPartitions.DailyPartition("2026-05-06");
        await leaderboard.AddAsync(Row(1000, oldDaily), oldDaily);
        await leaderboard.AddAsync(Row(900, recentDaily), recentDaily);
        await leaderboard.AddAsync(Row(800), LeaderboardEntity.PartitionAll);

        var deleted = await leaderboard.DeleteDailyPartitionsOlderThanAsync(30, utcNow);

        Assert.Equal(1, deleted);
        Assert.Empty(await leaderboard.GetTopAsync(10, oldDaily));
        Assert.Single(await leaderboard.GetTopAsync(10, recentDaily));
        Assert.Single(await leaderboard.GetTopAsync(10, LeaderboardEntity.PartitionAll));
    }

    [Fact]
    public async Task CS12_DeleteDailyPartitionsOlderThanAsync_keeps_exact_retention_boundary()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var leaderboard = new FakeLeaderboardRepository();
        var utcNow = DateTimeOffset.Parse("2026-06-04T12:00:00Z");
        var boundaryDaily = LeaderboardPartitions.DailyPartition("2026-05-05");
        await leaderboard.AddAsync(Row(1000, boundaryDaily), boundaryDaily);

        var deleted = await leaderboard.DeleteDailyPartitionsOlderThanAsync(30, utcNow);

        Assert.Equal(0, deleted);
        Assert.Single(await leaderboard.GetTopAsync(10, boundaryDaily));
    }

}
