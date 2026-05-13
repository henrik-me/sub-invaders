namespace SubInvaders.Api.Tests;

using System;
using System.Net;
using System.Threading.Tasks;
using SubInvaders.Api;
using SubInvaders.Api.Models;
using Xunit;

public class LeaderboardFunctionTests
{
    private static FakeHttpRequestData GetLeaderboard(string? period = null)
    {
        var url = period is null
            ? "https://localhost/api/leaderboard"
            : $"https://localhost/api/leaderboard?period={period}";
        return new FakeHttpRequestData("GET", url);
    }

    private static LeaderboardEntity Row(int score)
    {
        return new LeaderboardEntity
        {
            PartitionKey = LeaderboardEntity.PartitionAll,
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
    public async Task Period_daily_returns_501()
    {
        var leaderboard = new FakeLeaderboardRepository();
        var fn = new LeaderboardFunction(leaderboard);
        var resp = (FakeHttpResponseData)await fn.Run(GetLeaderboard("daily"));
        Assert.Equal(HttpStatusCode.NotImplemented, resp.StatusCode);
    }

    [Fact]
    public async Task Unknown_period_returns_400()
    {
        var leaderboard = new FakeLeaderboardRepository();
        var fn = new LeaderboardFunction(leaderboard);
        var resp = (FakeHttpResponseData)await fn.Run(GetLeaderboard("yearly"));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
}
