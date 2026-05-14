namespace SubInvaders.Api.Tests;

using System;
using SubInvaders.Api.Models;
using Xunit;

public class EntitiesTests
{
    [Fact]
    public void SessionEntity_partition_key_is_yyyymmdd_utc()
    {
        var ts = new DateTimeOffset(2026, 5, 13, 23, 30, 0, TimeSpan.Zero);
        Assert.Equal("20260513", SessionEntity.PartitionKeyFor(ts));
    }

    [Fact]
    public void LeaderboardEntity_row_key_inverts_score_for_ascending_sort()
    {
        var id = Guid.Empty;
        var high = LeaderboardEntity.FormatRowKey(1000, id);
        var low = LeaderboardEntity.FormatRowKey(10, id);
        Assert.True(string.CompareOrdinal(high, low) < 0,
            $"higher score must produce smaller RowKey for ascending sort; got high='{high}' low='{low}'");
    }

    [Fact]
    public void LeaderboardEntity_row_key_clamps_negative_and_above_max()
    {
        var id = Guid.Empty;
        var negative = LeaderboardEntity.FormatRowKey(-5, id);
        var huge = LeaderboardEntity.FormatRowKey(LeaderboardEntity.MaxScore + 100, id);
        Assert.StartsWith("99999999_", negative);
        Assert.StartsWith("00000000_", huge);
    }
}
