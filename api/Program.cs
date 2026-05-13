using System;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SubInvaders.Api;
using SubInvaders.Api.Middleware;
using SubInvaders.Api.Storage;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureFunctionsWebApplication(workerApp =>
    {
        workerApp.UseMiddleware<RateLimitMiddleware>();
    })
    .ConfigureServices(services =>
    {
        services.AddSingleton<IBuildInfoProvider, BuildInfoProvider>();

        var capacity = ParsePositiveInt(Environment.GetEnvironmentVariable("RATE_LIMIT_PER_MINUTE"), 30);
        services.AddSingleton<IRateLimiter>(_ => new SlidingWindowRateLimiter(capacity, TimeSpan.FromMinutes(1)));

        services.AddSingleton(_ => new ScoreOptions
        {
            MaxScorePerSecond = ParsePositiveInt(Environment.GetEnvironmentVariable("MAX_SCORE_PER_SECOND"), 50),
        });

        services.AddSingleton<ITableClientFactory>(_ =>
        {
            var connection = Environment.GetEnvironmentVariable("AzureWebJobsStorage")
                ?? throw new InvalidOperationException("AzureWebJobsStorage app setting is required");
            return new AzureTableClientFactory(connection);
        });

        services.AddSingleton<ISessionsRepository, SessionsRepository>();
        services.AddSingleton<ILeaderboardRepository, LeaderboardRepository>();
    })
    .Build();

await host.RunAsync();

static int ParsePositiveInt(string? value, int fallback)
{
    if (int.TryParse(value, out var parsed) && parsed > 0)
    {
        return parsed;
    }
    return fallback;
}
