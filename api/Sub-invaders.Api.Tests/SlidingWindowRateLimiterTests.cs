namespace SubInvaders.Api.Tests;

using System;
using System.Linq;
using System.Threading.Tasks;
using SubInvaders.Api.Middleware;
using Xunit;

public class SlidingWindowRateLimiterTests
{
    [Fact]
    public void Allows_up_to_capacity_then_rejects()
    {
        var limiter = new SlidingWindowRateLimiter(3, TimeSpan.FromMinutes(1));
        Assert.True(limiter.TryAcquire("a"));
        Assert.True(limiter.TryAcquire("a"));
        Assert.True(limiter.TryAcquire("a"));
        Assert.False(limiter.TryAcquire("a"));
    }

    [Fact]
    public void Buckets_are_independent()
    {
        var limiter = new SlidingWindowRateLimiter(2, TimeSpan.FromMinutes(1));
        Assert.True(limiter.TryAcquire("a"));
        Assert.True(limiter.TryAcquire("a"));
        Assert.False(limiter.TryAcquire("a"));
        Assert.True(limiter.TryAcquire("b"));
        Assert.True(limiter.TryAcquire("b"));
        Assert.False(limiter.TryAcquire("b"));
    }

    [Fact]
    public void Allows_more_after_window_slides()
    {
        var clockTime = DateTimeOffset.UtcNow;
        var limiter = new SlidingWindowRateLimiter(2, TimeSpan.FromSeconds(60), () => clockTime);
        Assert.True(limiter.TryAcquire("a"));
        Assert.True(limiter.TryAcquire("a"));
        Assert.False(limiter.TryAcquire("a"));

        clockTime = clockTime.AddSeconds(61);
        Assert.True(limiter.TryAcquire("a"));
    }

    [Fact]
    public async Task Concurrent_acquires_respect_cap()
    {
        const int capacity = 100;
        var limiter = new SlidingWindowRateLimiter(capacity, TimeSpan.FromMinutes(1));
        var tasks = Enumerable.Range(0, 500)
            .Select(_ => Task.Run(() => limiter.TryAcquire("shared") ? 1 : 0))
            .ToArray();
        var results = await Task.WhenAll(tasks);
        var allowed = results.Sum();
        Assert.Equal(capacity, allowed);
    }

    [Fact]
    public void Rejects_invalid_capacity_or_window()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new SlidingWindowRateLimiter(0, TimeSpan.FromMinutes(1)));
        Assert.Throws<ArgumentOutOfRangeException>(() => new SlidingWindowRateLimiter(1, TimeSpan.Zero));
    }

    [Fact]
    public void Empty_bucket_key_routes_to_unknown_bucket()
    {
        var limiter = new SlidingWindowRateLimiter(1, TimeSpan.FromMinutes(1));
        Assert.True(limiter.TryAcquire(""));
        Assert.False(limiter.TryAcquire(""));
    }
}
