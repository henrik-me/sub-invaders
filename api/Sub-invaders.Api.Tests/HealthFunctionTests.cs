namespace SubInvaders.Api.Tests;

using System.Net;
using System.Threading.Tasks;
using SubInvaders.Api;
using Xunit;

[Collection(FeatureFlagTestCollection.Name)]
public class HealthFunctionTests
{
    private sealed class FakeBuildInfo : IBuildInfoProvider
    {
        public string Version => "1.2.3.4";
        public string Commit => "abc1234";
    }

    [Fact]
    public async Task Health_returns_status_version_commit_and_default_flag_off()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, null);
        var fn = new HealthFunction(new FakeBuildInfo());
        var req = new FakeHttpRequestData("GET", "https://localhost/api/health");

        var resp = (FakeHttpResponseData)await fn.Run(req);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = resp.ReadBodyAs<HealthFunction.HealthBody>();
        Assert.NotNull(body);
        Assert.Equal("ok", body!.Status);
        Assert.Equal("1.2.3.4", body.Version);
        Assert.Equal("abc1234", body.Commit);
        Assert.Equal("off", body.Flags.DailyChallenge);
    }

    [Fact]
    public async Task Health_exposes_daily_flag_when_enabled()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "on");
        var fn = new HealthFunction(new FakeBuildInfo());
        var req = new FakeHttpRequestData("GET", "https://localhost/api/health");

        var resp = (FakeHttpResponseData)await fn.Run(req);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = resp.ReadBodyAs<HealthFunction.HealthBody>();
        Assert.NotNull(body);
        Assert.Equal("on", body!.Flags.DailyChallenge);
    }

    [Fact]
    public async Task Health_exposes_daily_flag_as_off_for_non_on_values()
    {
        using var dailyFlag = new EnvironmentVariableScope(FeatureFlags.DailyChallengeEnvironmentVariable, "off");
        var fn = new HealthFunction(new FakeBuildInfo());
        var req = new FakeHttpRequestData("GET", "https://localhost/api/health");

        var resp = (FakeHttpResponseData)await fn.Run(req);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = resp.ReadBodyAs<HealthFunction.HealthBody>();
        Assert.NotNull(body);
        Assert.Equal("off", body!.Flags.DailyChallenge);
    }

    [Fact]
    public void BuildInfoProvider_loaded_assembly_exposes_version_and_a_commit_string()
    {
        // Loaded-assembly smoke test: regardless of whether dotnet build was invoked
        // with BUILD_COMMIT set or unset, BuildInfoProvider must construct successfully
        // and expose non-empty Version + Commit strings. The pure-function tests below
        // cover the actual parsing rules.
        var info = new BuildInfoProvider();
        Assert.False(string.IsNullOrWhiteSpace(info.Version));
        Assert.False(string.IsNullOrWhiteSpace(info.Commit));
    }

    [Theory]
    // Default: MSBuild "1.0.0" with SourceLink-appended source SHA -> "unknown".
    [InlineData("1.0.0+0123456789abcdef0123456789abcdef01234567", "unknown")]
    // Default with no SourceLink suffix.
    [InlineData("1.0.0", "unknown")]
    // BUILD_COMMIT set to a full 40-char SHA, with SourceLink suffix appended:
    // returns first 7 chars of the BUILD_COMMIT (NOT the SourceLink suffix).
    [InlineData("abc1234567890fedcba0987654321abcdef01234+f00ba12abc1234567890fedcba0987654321abcd", "abc1234")]
    // BUILD_COMMIT set to a 7-char prefix.
    [InlineData("abc1234+f00ba12abc1234567890fedcba0987654321abcd", "abc1234")]
    // BUILD_COMMIT alone (no SourceLink suffix), 40 chars.
    [InlineData("0123456789abcdef0123456789abcdef01234567", "0123456")]
    // Future-proofing: a deliberately set semantic <Version> like "1.1.0" must NOT be
    // mistaken for a commit. Hex shape rejects "1.1.0" (period is non-hex).
    [InlineData("1.1.0+0123456789abcdef0123456789abcdef01234567", "unknown")]
    [InlineData("2.0.0-beta.1", "unknown")]
    // Edge cases: too short, mixed garbage, empty.
    [InlineData("abc12+f00ba12abc1234567890fedcba0987654321abcd", "unknown")]
    [InlineData("garbage", "unknown")]
    [InlineData("", "unknown")]
    [InlineData(null, "unknown")]
    public void ParseCommitFromInformationalVersion_returns_expected(string? input, string expected)
    {
        Assert.Equal(expected, BuildInfoProvider.ParseCommitFromInformationalVersion(input));
    }
}
