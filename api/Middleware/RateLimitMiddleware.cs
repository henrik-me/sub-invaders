namespace SubInvaders.Api.Middleware;

using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Middleware;
using SubInvaders.Api.Common;

public sealed class RateLimitMiddleware : IFunctionsWorkerMiddleware
{
    private static readonly HashSet<string> RateLimitedFunctions = new(StringComparer.Ordinal)
    {
        "Session",
        "Score",
    };

    private readonly IRateLimiter _limiter;

    public RateLimitMiddleware(IRateLimiter limiter)
    {
        _limiter = limiter;
    }

    public static bool IsRateLimited(string functionName) => RateLimitedFunctions.Contains(functionName);

    public static string BuildBucketKey(string functionName, string clientIp) => $"{functionName}:{clientIp}";

    public static async Task<HttpResponseData> BuildRejectionResponseAsync(HttpRequestData req)
    {
        var resp = await JsonResponse.Error(req, HttpStatusCode.TooManyRequests, "rate_limited",
            "rate limit exceeded; try again later").ConfigureAwait(false);
        resp.Headers.Add("Retry-After", "60");
        return resp;
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        if (!IsRateLimited(context.FunctionDefinition.Name))
        {
            await next(context).ConfigureAwait(false);
            return;
        }

        var req = await context.GetHttpRequestDataAsync().ConfigureAwait(false);
        if (req is null)
        {
            await next(context).ConfigureAwait(false);
            return;
        }

        var ip = RequestHelpers.ResolveClientIp(req);
        var bucket = BuildBucketKey(context.FunctionDefinition.Name, ip);
        if (!_limiter.TryAcquire(bucket))
        {
            var resp = await BuildRejectionResponseAsync(req).ConfigureAwait(false);
            context.GetInvocationResult().Value = resp;
            return;
        }

        await next(context).ConfigureAwait(false);
    }
}
