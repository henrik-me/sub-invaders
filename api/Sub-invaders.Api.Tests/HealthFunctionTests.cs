namespace SubInvaders.Api.Tests;

using System.Net;
using System.Threading.Tasks;
using SubInvaders.Api;
using Xunit;

public class HealthFunctionTests
{
    private sealed class FakeBuildInfo : IBuildInfoProvider
    {
        public string Version => "1.2.3.4";
        public string Commit => "abc1234";
    }

    [Fact]
    public async Task Health_returns_status_version_commit()
    {
        var fn = new HealthFunction(new FakeBuildInfo());
        var req = new FakeHttpRequestData("GET", "https://localhost/api/health");

        var resp = (FakeHttpResponseData)await fn.Run(req);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = resp.ReadBodyAs<HealthFunction.HealthBody>();
        Assert.NotNull(body);
        Assert.Equal("ok", body!.Status);
        Assert.Equal("1.2.3.4", body.Version);
        Assert.Equal("abc1234", body.Commit);
    }

    [Fact]
    public void BuildInfoProvider_falls_back_to_unknown_when_env_unset()
    {
        System.Environment.SetEnvironmentVariable("SUB_INVADERS_COMMIT", null);
        System.Environment.SetEnvironmentVariable("GITHUB_SHA", null);
        var info = new BuildInfoProvider();
        Assert.Equal("unknown", info.Commit);
        Assert.False(string.IsNullOrWhiteSpace(info.Version));
    }
}
