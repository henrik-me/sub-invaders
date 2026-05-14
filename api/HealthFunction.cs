namespace SubInvaders.Api;

using System;
using System.Net;
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
        Commit = ResolveCommit();
    }

    public string Version { get; }
    public string Commit { get; }

    private static string ResolveCommit()
    {
        var candidates = new[] { "SUB_INVADERS_COMMIT", "GITHUB_SHA" };
        foreach (var key in candidates)
        {
            var value = Environment.GetEnvironmentVariable(key);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Length >= 7 ? value[..7] : value;
            }
        }
        return "unknown";
    }
}
