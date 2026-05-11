using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Hosting;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureFunctionsWebApplication()
    .Build();

await host.RunAsync();
