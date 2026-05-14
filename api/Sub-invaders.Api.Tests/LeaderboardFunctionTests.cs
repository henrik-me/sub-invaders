namespace SubInvaders.Api.Tests;

using System;
using System.Net;
using System.Threading.Tasks;
using SubInvaders.Api;
using SubInvaders.Api.Common;
using SubInvaders.Api.Models;
using SubInvaders.Api.Storage;
using Xunit;

[Collection(FeatureFlagTestCollection.Name)]
public class LeaderboardFunctionTests
{
    private static FakeHttpRequestData GetLeaderboard(string? period = null, string? date = null)
    {
        var query = "";
        if (period is not null)
        {
            query = $"?period={period}";
        }
        if (date is not null)
        {
            query += string.IsNullOrEmpty(query) ? $"?date={date}" : $"&date={date}";
        }
        return new FakeHttpRequestData("GET", $"https://localhost/api/leaderboard{query}");
    }

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
    public async Task Period_all_returns_top_100_sorted_descending_with_ranks()
    {
        var leaderboard = new FakeLeaderboardRepository();
        for (int i = 0; i < 50; i++)
        {
            await leaderboard.AddAsync(Row(i * 10));
        }
        var fn = new LeaderboardFunction(leaderboard);
        var resp = (FakeHttpResponseData)await fn.Run(GetLeaderboard("all"));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = resp.ReadBodyAs<LeaderboardFunction.LeaderboardBody>()!;
        Assert.Equal("all", body.Period);
        Assert.Equal(50, body.Entries.Length);
        Assert.Equal(1, body.Entries[0].Rank);
        Assert.True(body.Entries[0].Score >= body.Entries[1].Score);
        for (int i = 1; i < body.Entries.Length; i++)
        {
            Assert.True(body.Entries[i - 1].Score >= body.Entries[i].Score,
                $"row {i - 1} ({body.Entries[i - 1].Score}) must be >= row {i} ({body.Entries[i].Score})");
            Assert.Equal(i + 1, body.Entries[i].Rank);
        }
    }

    [Fact]
    public async Task Period_omitted_defaults_to_all()
    {
        var leaderboard = new FakeLeaderboardRepository();
        await leaderboard.AddAsync(Row(123));
        var fn = new LeaderboardFunction(leaderboard);
        var resp = (FakeHttpResponseData)await fn.Run(GetLeaderboard(null));
        var body = resp.ReadBodyAs<LeaderboardFunction.LeaderboardBody>()!;
        Assert.Equal("all", body.Period);
        Assert.Single(body.Entries);
    }

    [Fact]
    public async Task Period_daily_flag_off_returns_403()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, null);
        var leaderboard = new FakeLeaderboardRepository();
        var fn = new LeaderboardFunction(leaderboard);

        var resp = (FakeHttpResponseData)await fn.Run(GetLeaderboard("daily", "2026-05-14"));

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
        var body = resp.ReadBodyAs<JsonResponse.ErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("feature_disabled", body!.Error);
        Assert.Equal("daily challenge is disabled", body.Message);
    }

    [Fact]
    public async Task Period_daily_flag_on_valid_date_reads_daily_partition_only()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var leaderboard = new FakeLeaderboardRepository();
        await leaderboard.AddAsync(Row(100), LeaderboardEntity.PartitionAll);
        await leaderboard.AddAsync(Row(900, LeaderboardPartitions.DailyPartition("2026-05-14")),
            LeaderboardPartitions.DailyPartition("2026-05-14"));
        await leaderboard.AddAsync(Row(700, LeaderboardPartitions.DailyPartition("2026-05-13")),
            LeaderboardPartitions.DailyPartition("2026-05-13"));
        var fn = new LeaderboardFunction(leaderboard);

        var resp = (FakeHttpResponseData)await fn.Run(GetLeaderboard("daily", "2026-05-14"));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = resp.ReadBodyAs<LeaderboardFunction.LeaderboardBody>();
        Assert.NotNull(body);
        Assert.Equal("daily", body!.Period);
        var entry = Assert.Single(body.Entries);
        Assert.Equal(900, entry.Score);
    }

    [Fact]
    public async Task Period_daily_flag_on_missing_date_returns_400()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var leaderboard = new FakeLeaderboardRepository();
        var fn = new LeaderboardFunction(leaderboard);

        var resp = (FakeHttpResponseData)await fn.Run(GetLeaderboard("daily"));

        AssertInvalidDate(resp, "date must be YYYY-MM-DD");
    }

    [Fact]
    public async Task Period_daily_flag_on_invalid_date_returns_400()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var leaderboard = new FakeLeaderboardRepository();
        var fn = new LeaderboardFunction(leaderboard);

        var resp = (FakeHttpResponseData)await fn.Run(GetLeaderboard("daily", "20260514"));

        AssertInvalidDate(resp, "date must be YYYY-MM-DD");
    }

    [Fact]
    public async Task Unknown_period_returns_400()
    {
        var leaderboard = new FakeLeaderboardRepository();
        var fn = new LeaderboardFunction(leaderboard);
        var resp = (FakeHttpResponseData)await fn.Run(GetLeaderboard("yearly"));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    private static void AssertInvalidDate(FakeHttpResponseData resp, string message)
    {
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = resp.ReadBodyAs<JsonResponse.ErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("invalid_argument", body!.Error);
        Assert.Equal(message, body.Message);
    }
}
