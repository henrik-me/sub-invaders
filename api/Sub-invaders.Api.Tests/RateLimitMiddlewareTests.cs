namespace SubInvaders.Api.Tests;

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using SubInvaders.Api.Middleware;
using Xunit;

/// <summary>
/// Tests for <see cref="RateLimitMiddleware"/>.
///
/// The middleware end-to-end pipeline calls <c>context.GetHttpRequestDataAsync()</c>,
/// which probes <c>Features.Get&lt;IHttpRequestDataFeature&gt;()</c>. That interface
/// is <c>internal</c> in <c>Microsoft.Azure.Functions.Worker.Core</c> 2.x, so test
/// code cannot implement it. Tests therefore split coverage:
///
///   - Pure-helper tests verify <see cref="RateLimitMiddleware.IsRateLimited"/>,
///     <see cref="RateLimitMiddleware.BuildBucketKey"/>, and
///     <see cref="RateLimitMiddleware.BuildRejectionResponseAsync"/>.
///   - Pipeline tests verify the pass-through path (non-rate-limited function names)
///     and the defensive null-request path. Both are observable without any
///     <c>IHttpRequestDataFeature</c>.
///   - Sliding-window expiration and concurrent-access safety of the limiter
///     itself are covered exhaustively by <see cref="SlidingWindowRateLimiterTests"/>.
///   - IP resolution from <c>X-Forwarded-For</c> / <c>X-Azure-ClientIP</c> is covered
///     by <see cref="RequestHelpersTests"/>.
/// </summary>
public class RateLimitMiddlewareTests
{
    // -----------------------------------------------------------------------
    // Pure-helper coverage
    // -----------------------------------------------------------------------

    [Fact]
    public void IsRateLimited_returns_true_only_for_Session_and_Score()
    {
        Assert.True(RateLimitMiddleware.IsRateLimited("Session"));
        Assert.True(RateLimitMiddleware.IsRateLimited("Score"));
        Assert.False(RateLimitMiddleware.IsRateLimited("Health"));
        Assert.False(RateLimitMiddleware.IsRateLimited("Leaderboard"));
        Assert.False(RateLimitMiddleware.IsRateLimited("SessionsCleanup"));
        Assert.False(RateLimitMiddleware.IsRateLimited("session")); // ordinal match — case-sensitive
        Assert.False(RateLimitMiddleware.IsRateLimited(""));
    }

    [Fact]
    public void BuildBucketKey_prefixes_function_name_to_ip()
    {
        Assert.Equal("Session:203.0.113.7", RateLimitMiddleware.BuildBucketKey("Session", "203.0.113.7"));
        Assert.Equal("Score:198.51.100.4", RateLimitMiddleware.BuildBucketKey("Score", "198.51.100.4"));
        Assert.Equal("Session:unknown", RateLimitMiddleware.BuildBucketKey("Session", "unknown"));
    }

    [Fact]
    public async Task BuildRejectionResponseAsync_returns_429_with_retry_after_60_and_rate_limited_body()
    {
        var req = new FakeHttpRequestData("POST", "https://localhost/api/session");

        var resp = (FakeHttpResponseData)await RateLimitMiddleware.BuildRejectionResponseAsync(req);

        Assert.Equal(HttpStatusCode.TooManyRequests, resp.StatusCode);
        Assert.True(resp.Headers.TryGetValues("Retry-After", out var retryValues), "Retry-After header must be set");
        Assert.Equal("60", retryValues!.First());
        Assert.True(resp.Headers.TryGetValues("Content-Type", out var ctValues));
        Assert.Contains("application/json", ctValues!.First());

        var body = resp.ReadBodyAsString();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("rate_limited", doc.RootElement.GetProperty("error").GetString());
        Assert.False(string.IsNullOrEmpty(doc.RootElement.GetProperty("message").GetString()));
    }

    // -----------------------------------------------------------------------
    // Middleware pipeline coverage (paths that do not require a request)
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("Health")]
    [InlineData("Leaderboard")]
    [InlineData("SessionsCleanup")]
    public async Task Non_rate_limited_function_passes_through_without_consulting_limiter(string functionName)
    {
        var limiter = new StubLimiter(allow: true);
        var middleware = new RateLimitMiddleware(limiter);
        var ctx = new MwFunctionContext(functionName);
        var nextCalled = 0;

        await middleware.Invoke(ctx, _ => { nextCalled++; return Task.CompletedTask; });

        Assert.Equal(1, nextCalled);
        Assert.Empty(limiter.AcquireAttempts);
    }

    [Theory]
    [InlineData("Session")]
    [InlineData("Score")]
    public async Task Rate_limited_function_without_http_request_falls_through_to_next(string functionName)
    {
        // Defensive: if the rate-limited function is invoked through a non-HTTP trigger
        // (an unsupported deployment scenario), the middleware must not crash; it falls
        // through to next() without consulting the limiter. In test, this branch fires
        // because GetHttpRequestDataAsync returns null when no IHttpRequestDataFeature
        // is present in Features.
        var limiter = new StubLimiter(allow: true);
        var middleware = new RateLimitMiddleware(limiter);
        var ctx = new MwFunctionContext(functionName);
        var nextCalled = 0;

        await middleware.Invoke(ctx, _ => { nextCalled++; return Task.CompletedTask; });

        Assert.Equal(1, nextCalled);
        Assert.Empty(limiter.AcquireAttempts);
    }
}

internal sealed class StubLimiter : IRateLimiter
{
    private readonly bool _allow;
    public List<string> AcquireAttempts { get; } = new();

    public StubLimiter(bool allow)
    {
        _allow = allow;
    }

    public bool TryAcquire(string bucketKey)
    {
        AcquireAttempts.Add(bucketKey);
        return _allow;
    }
}

internal sealed class MwFunctionContext : FunctionContext
{
    private readonly MwFunctionDefinition _definition;
    private readonly MwInvocationFeatures _features = new();

    public MwFunctionContext(string functionName)
    {
        _definition = new MwFunctionDefinition(functionName);
    }

    public override string InvocationId => "mw-test-invocation";
    public override string FunctionId => "mw-test-function";
    public override TraceContext TraceContext => null!;
    public override BindingContext BindingContext => null!;
    public override RetryContext RetryContext => null!;
    public override IServiceProvider InstanceServices { get; set; } = null!;
    public override FunctionDefinition FunctionDefinition => _definition;
    public override IDictionary<object, object> Items { get; set; } = new Dictionary<object, object>();
    public override IInvocationFeatures Features => _features;
}

internal sealed class MwFunctionDefinition : FunctionDefinition
{
    public MwFunctionDefinition(string name)
    {
        Name = name;
        Id = name;
        EntryPoint = name;
        PathToAssembly = name;
    }

    public override System.Collections.Immutable.ImmutableArray<FunctionParameter> Parameters =>
        System.Collections.Immutable.ImmutableArray<FunctionParameter>.Empty;
    public override string PathToAssembly { get; }
    public override string EntryPoint { get; }
    public override string Id { get; }
    public override string Name { get; }
    public override System.Collections.Immutable.IImmutableDictionary<string, BindingMetadata> InputBindings =>
        System.Collections.Immutable.ImmutableDictionary<string, BindingMetadata>.Empty;
    public override System.Collections.Immutable.IImmutableDictionary<string, BindingMetadata> OutputBindings =>
        System.Collections.Immutable.ImmutableDictionary<string, BindingMetadata>.Empty;
}

internal sealed class MwInvocationFeatures : IInvocationFeatures
{
    private readonly Dictionary<Type, object> _items = new();

    public T? Get<T>()
    {
        if (_items.TryGetValue(typeof(T), out var v))
        {
            return (T)v;
        }
        return default;
    }

    public void Set<T>(T instance)
    {
        if (instance is null)
        {
            _items.Remove(typeof(T));
        }
        else
        {
            _items[typeof(T)] = instance;
        }
    }

    public IEnumerator<KeyValuePair<Type, object>> GetEnumerator() => _items.GetEnumerator();

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
