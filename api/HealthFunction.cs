namespace SubInvaders.Api;

using System;
using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;
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
    public BuildInfoProvider()
    {
        Version = typeof(BuildInfoProvider).Assembly.GetName().Version?.ToString() ?? "0.0.0.0";
        var info = typeof(BuildInfoProvider).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        Commit = ParseCommitFromInformationalVersion(info);
    }

    public string Version { get; }
    public string Commit { get; }

    // Pre-compiled hex regex: 7-40 hex chars, matches a git SHA prefix or full SHA.
    private static readonly Regex CommitShape = new("^[0-9a-fA-F]{7,40}$", RegexOptions.Compiled);

    /// <summary>
    /// Issue #52 parser. The deploy commit is baked into the assembly at build time via
    /// <c>&lt;InformationalVersion&gt;$(BUILD_COMMIT)&lt;/InformationalVersion&gt;</c> in the csproj
    /// (the workflow exports <c>BUILD_COMMIT=${{ github.sha }}</c> at job level; modern .NET SDK
    /// auto-promotes env vars to MSBuild properties during <c>dotnet build</c>).
    ///
    /// SourceLink auto-appends a <c>+&lt;source-git-sha&gt;</c> suffix to InformationalVersion;
    /// this method splits on '+' and validates the prefix is hex of length 7-40 before returning
    /// the first 7 chars. Anything else (including MSBuild's default "1.0.0", a manually-set
    /// semantic version, or garbage) is reported as "unknown" so /api/health doesn't lie.
    /// </summary>
    internal static string ParseCommitFromInformationalVersion(string? informationalVersion)
    {
        if (string.IsNullOrWhiteSpace(informationalVersion))
        {
            return "unknown";
        }
        var plusIndex = informationalVersion.IndexOf('+');
        var candidate = plusIndex >= 0 ? informationalVersion[..plusIndex] : informationalVersion;
        return CommitShape.IsMatch(candidate) ? candidate[..7] : "unknown";
    }
}
