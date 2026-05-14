namespace SubInvaders.Api.Tests;

using System;
using System.Linq;
using System.Threading.Tasks;
using SubInvaders.Api.Models;
using SubInvaders.Api.Storage;
using Xunit;

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
}
