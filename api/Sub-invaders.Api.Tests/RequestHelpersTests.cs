namespace SubInvaders.Api.Tests;

using System.Threading.Tasks;
using SubInvaders.Api.Common;
using Xunit;

public class RequestHelpersTests
{
    [Fact]
    public void ResolveClientIp_uses_first_forwarded_for_token()
    {
        var req = new FakeHttpRequestData("GET", "https://localhost/", headers: new()
        {
            { "X-Forwarded-For", "203.0.113.5, 10.0.0.1" },
        });
        Assert.Equal("203.0.113.5", RequestHelpers.ResolveClientIp(req));
    }

    [Fact]
    public void ResolveClientIp_returns_unknown_when_no_headers()
    {
        var req = new FakeHttpRequestData("GET", "https://localhost/");
        Assert.Equal("unknown", RequestHelpers.ResolveClientIp(req));
    }

    [Fact]
    public async Task ReadBodyBoundedAsync_returns_full_body_when_under_limit()
    {
        var req = new FakeHttpRequestData("POST", "https://localhost/", "hello");
        var (ok, body, error) = await RequestHelpers.ReadBodyBoundedAsync(req, 1024);
        Assert.True(ok);
        Assert.Equal("hello", body);
        Assert.Null(error);
    }

    [Fact]
    public async Task ReadBodyBoundedAsync_rejects_oversized_body()
    {
        var big = new string('x', 2048);
        var req = new FakeHttpRequestData("POST", "https://localhost/", big);
        var (ok, _, error) = await RequestHelpers.ReadBodyBoundedAsync(req, 1024);
        Assert.False(ok);
        Assert.Contains("1024", error);
    }
}
