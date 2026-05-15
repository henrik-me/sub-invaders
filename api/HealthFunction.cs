namespace SubInvaders.Api;

using System;
using System.Net;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using SubInvaders.Api.Common;

public class HealthFunction
{
    private readonly IBuildInfoProvider _buildInfo;

    public HealthFunction(IBuildInfoProvider buildInfo)
    {
        _buildInfo = buildInfo;
    }

    [Function("Health")]
    public Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequestData req)
    {
        var body = new HealthBody(
            "ok",
            _buildInfo.Version,
            _buildInfo.Commit,
            new HealthFlags(FeatureFlags.DailyChallengeState));
        return JsonResponse.Write(req, HttpStatusCode.OK, body);
    }

    public sealed record HealthBody(string Status, string Version, string Commit, HealthFlags Flags);
    public sealed record HealthFlags(string DailyChallenge);
}

public static class FeatureFlags
{
    public const string DailyChallengeEnvironmentVariable = "FEATURE_FLAGS_DAILY_CHALLENGE";

    public static bool IsDailyChallengeEnabled() =>
        Environment.GetEnvironmentVariable(DailyChallengeEnvironmentVariable) == "on";

    public static string DailyChallengeState => IsDailyChallengeEnabled() ? "on" : "off";
}

public interface IBuildInfoProvider
{
    string Version { get; }
    string Commit { get; }
}

public sealed class BuildInfoProvider : IBuildInfoProvider
{
    // MSBuild's default InformationalVersion when no <Version> or <InformationalVersion>
    // is set. swa-deploy.yml overrides this at build time via -p:BUILD_COMMIT=<sha>;
    // local dotnet build/test invocations leave it at the default and get "unknown"
    // (matching prior env-var-fallback behaviour).
    private const string DefaultInformationalVersion = "1.0.0";

    public BuildInfoProvider()
    {
        Version = typeof(BuildInfoProvider).Assembly.GetName().Version?.ToString() ?? "0.0.0.0";
        Commit = ResolveCommit();
    }

    public string Version { get; }
    public string Commit { get; }

    private static string ResolveCommit()
    {
        // Issue #52: the deploy commit is baked into the assembly at build time via
        // <InformationalVersion>$(BUILD_COMMIT)</InformationalVersion> (see csproj).
        // This is atomic with the deploy artifact (no post-deploy app-setting mutation,
        // no Function host cold restart, no Service Principal needed).
        var info = typeof(BuildInfoProvider).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (!string.IsNullOrWhiteSpace(info)
            && !info.StartsWith(DefaultInformationalVersion, StringComparison.Ordinal))
        {
            return info.Length >= 7 ? info[..7] : info;
        }
        return "unknown";
    }
}
