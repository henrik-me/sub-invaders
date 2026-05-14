namespace SubInvaders.Api.Tests;

using System;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using SubInvaders.Api;
using SubInvaders.Api.Models;
using Xunit;

public class ScoreFunctionTests
{
    private static (ScoreFunction Fn, FakeSessionsRepository Sessions, FakeLeaderboardRepository Leaderboard, SessionEntity Session)
        Setup(int score = 500, double elapsedSeconds = 60)
    {
        var sessions = new FakeSessionsRepository();
        var leaderboard = new FakeLeaderboardRepository();
        var startedAt = DateTimeOffset.UtcNow - TimeSpan.FromSeconds(elapsedSeconds);
        var sessionId = Guid.NewGuid().ToString("D");
        var session = new SessionEntity
        {
            PartitionKey = SessionEntity.PartitionKeyFor(startedAt),
            RowKey = sessionId,
            Nonce = "deadbeef",
            StartedAt = startedAt,
        };
        sessions.Seed(session);
        var fn = new ScoreFunction(sessions, leaderboard, new ScoreOptions { MaxScorePerSecond = 50 });
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
        var stored = await sessions.GetAsync(session.PartitionKey, session.RowKey);
        Assert.True(stored!.Consumed);
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
}
