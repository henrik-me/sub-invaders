namespace SubInvaders.Api.Tests;

using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using SubInvaders.Api.Models;
using SubInvaders.Api.Storage;

public sealed class FakeSessionsRepository : ISessionsRepository
{
    private readonly ConcurrentDictionary<string, SessionEntity> _items = new();

    public int Count => _items.Count;

    public Task CreateAsync(SessionEntity entity, CancellationToken ct = default)
    {
        var key = Key(entity.PartitionKey, entity.RowKey);
        if (!_items.TryAdd(key, entity))
        {
            throw new InvalidOperationException("entity already exists");
        }
        return Task.CompletedTask;
    }

    public Task<SessionEntity?> GetAsync(string partitionKey, string sessionId, CancellationToken ct = default)
    {
        _items.TryGetValue(Key(partitionKey, sessionId), out var entity);
        return Task.FromResult(entity);
    }

    public Task<SessionEntity?> FindAcrossPartitionsAsync(string sessionId, CancellationToken ct = default)
    {
        var entity = _items.Values.FirstOrDefault(e => e.RowKey == sessionId);
        return Task.FromResult<SessionEntity?>(entity);
    }

    public Task<bool> TryConsumeAsync(SessionEntity entity, CancellationToken ct = default)
    {
        var key = Key(entity.PartitionKey, entity.RowKey);
        if (!_items.TryGetValue(key, out var stored))
        {
            return Task.FromResult(false);
        }
        lock (stored)
        {
            if (stored.Consumed)
            {
                return Task.FromResult(false);
            }
            stored.Consumed = true;
            stored.ConsumedAt = DateTimeOffset.UtcNow;
            entity.Consumed = true;
            entity.ConsumedAt = stored.ConsumedAt;
        }
        return Task.FromResult(true);
    }

    public Task DeleteOlderThanAsync(DateTimeOffset cutoffUtc, CancellationToken ct = default)
    {
        foreach (var kv in _items.Where(kv => kv.Value.StartedAt < cutoffUtc).ToList())
        {
            _items.TryRemove(kv.Key, out _);
        }
        return Task.CompletedTask;
    }

    public void Seed(SessionEntity entity)
    {
        _items[Key(entity.PartitionKey, entity.RowKey)] = entity;
    }

    private static string Key(string pk, string rk) => $"{pk}|{rk}";
}

public sealed class FakeLeaderboardRepository : ILeaderboardRepository
{
    private readonly System.Collections.Generic.SortedDictionary<string, LeaderboardEntity> _items =
        new(StringComparer.Ordinal);
    private readonly object _lock = new();

    public int Count
    {
        get
        {
            lock (_lock) { return _items.Count; }
        }
    }

    public Task AddAsync(LeaderboardEntity entity, CancellationToken ct = default)
    {
        lock (_lock)
        {
            _items[entity.RowKey] = entity;
        }
        return Task.CompletedTask;
    }

    public Task<System.Collections.Generic.IReadOnlyList<LeaderboardEntity>> GetTopAsync(int top, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var list = _items.Values.Take(top).ToList();
            return Task.FromResult<System.Collections.Generic.IReadOnlyList<LeaderboardEntity>>(list);
        }
    }

    public Task<int> TrimAsync(int keep, CancellationToken ct = default)
    {
        lock (_lock)
        {
            int kept = 0;
            int deleted = 0;
            foreach (var key in _items.Keys.ToList())
            {
                if (kept < keep)
                {
                    kept++;
                    continue;
                }
                _items.Remove(key);
                deleted++;
            }
            return Task.FromResult(deleted);
        }
    }
}
