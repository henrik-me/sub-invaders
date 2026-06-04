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

        var capacity = ApiConfig.ParsePositiveInt(Environment.GetEnvironmentVariable("RATE_LIMIT_PER_MINUTE"), 30);
        services.AddSingleton<IRateLimiter>(_ => new SlidingWindowRateLimiter(capacity, TimeSpan.FromMinutes(1)));

        services.AddSingleton(_ => ApiConfig.BuildScoreOptionsFromEnvironment());
        services.AddSingleton(_ => ApiConfig.BuildCleanupOptionsFromEnvironment());

        services.AddSingleton<ITableClientFactory>(_ =>
        {
            // SWA reserves the 'AzureWebJobsStorage' app setting for the
            // managed Functions internal storage and refuses to let the
            // operator override it. We therefore read our own
            // 'SUB_INVADERS_STORAGE' app setting first, falling back to
            // 'AzureWebJobsStorage' so local dev (where the dev storage
            // emulator is wired through the Functions runtime variable)
            // keeps working without two env vars in local.settings.json.
            var connection = Environment.GetEnvironmentVariable("SUB_INVADERS_STORAGE")
                ?? Environment.GetEnvironmentVariable("AzureWebJobsStorage")
                ?? throw new InvalidOperationException("SUB_INVADERS_STORAGE (or AzureWebJobsStorage for local dev) app setting is required");
            return new AzureTableClientFactory(connection);
        });

        services.AddSingleton<ISessionsRepository, SessionsRepository>();
        services.AddSingleton<ILeaderboardRepository, LeaderboardRepository>();
    })
    .Build();

await host.RunAsync();
