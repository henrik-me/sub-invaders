namespace SubInvaders.Api.Tests;

using System.Net;
using System.Threading.Tasks;
using SubInvaders.Api;
using Xunit;

public class SessionFunctionTests
{
    [Fact]
    public async Task Post_session_returns_uuid_nonce_started_at_and_persists_row()
    {
        var sessions = new FakeSessionsRepository();
        var fn = new SessionFunction(sessions);
        var req = new FakeHttpRequestData("POST", "https://localhost/api/session");

        var resp = (FakeHttpResponseData)await fn.Run(req);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = resp.ReadBodyAs<SessionFunction.SessionBody>();
        Assert.NotNull(body);
        Assert.True(System.Guid.TryParse(body!.SessionId, out _));
        Assert.False(string.IsNullOrEmpty(body.Nonce));
        Assert.True(body.Nonce.Length >= 16);
        Assert.True(System.DateTimeOffset.TryParse(body.StartedAt, out _));
        Assert.Equal(1, sessions.Count);
    }

    [Fact]
    public async Task Post_session_generates_unique_session_ids()
    {
        var sessions = new FakeSessionsRepository();
        var fn = new SessionFunction(sessions);

        var ids = new System.Collections.Generic.HashSet<string>();
        for (int i = 0; i < 5; i++)
        {
            var req = new FakeHttpRequestData("POST", "https://localhost/api/session");
            var resp = (FakeHttpResponseData)await fn.Run(req);
            var body = resp.ReadBodyAs<SessionFunction.SessionBody>()!;
            Assert.True(ids.Add(body.SessionId));
        }
        Assert.Equal(5, sessions.Count);
    }
}
