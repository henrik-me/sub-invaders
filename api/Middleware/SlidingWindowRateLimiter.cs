namespace SubInvaders.Api.Middleware;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;

public interface IRateLimiter
{
    bool TryAcquire(string bucketKey);
}

public sealed class SlidingWindowRateLimiter : IRateLimiter
{
    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> _buckets = new(StringComparer.Ordinal);
    private readonly Func<DateTimeOffset> _clock;
    private readonly int _capacity;
    private readonly TimeSpan _window;

    public SlidingWindowRateLimiter(int capacity, TimeSpan window, Func<DateTimeOffset>? clock = null)
    {
        if (capacity <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(capacity), "capacity must be > 0");
        }
        if (window <= TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(nameof(window), "window must be > 0");
        }
        _capacity = capacity;
        _window = window;
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    public int Capacity => _capacity;
    public TimeSpan Window => _window;

    public bool TryAcquire(string bucketKey)
    {
        if (string.IsNullOrEmpty(bucketKey))
        {
            bucketKey = "unknown";
        }
        var queue = _buckets.GetOrAdd(bucketKey, _ => new Queue<DateTimeOffset>());
        lock (queue)
        {
            var now = _clock();
            var cutoff = now - _window;
            while (queue.Count > 0 && queue.Peek() <= cutoff)
            {
                queue.Dequeue();
            }
            if (queue.Count >= _capacity)
            {
                return false;
            }
            queue.Enqueue(now);
            return true;
        }
    }
}
