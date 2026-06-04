namespace SubInvaders.Api.Storage;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Azure.Data.Tables;
using SubInvaders.Api.Models;

public sealed class LeaderboardRepository : ILeaderboardRepository
{
    private readonly TableClient _table;

    public LeaderboardRepository(ITableClientFactory factory)
    {
        _table = factory.GetClient(TableNames.Leaderboard);
    }

    public async Task AddAsync(
        LeaderboardEntity entity,
        string partitionKey = LeaderboardEntity.PartitionAll,
        CancellationToken ct = default)
    {
        entity.PartitionKey = partitionKey;
        await _table.AddEntityAsync(entity, ct).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<LeaderboardEntity>> GetTopAsync(
        int top,
        string partitionKey = LeaderboardEntity.PartitionAll,
        CancellationToken ct = default)
    {
        if (top <= 0)
        {
            return System.Array.Empty<LeaderboardEntity>();
        }
        var filter = TableClient.CreateQueryFilter($"PartitionKey eq {partitionKey}");
        var results = new List<LeaderboardEntity>(top);
        await foreach (var page in _table.QueryAsync<LeaderboardEntity>(filter, maxPerPage: top, cancellationToken: ct).AsPages().ConfigureAwait(false))
        {
            foreach (var row in page.Values)
            {
                results.Add(row);
                if (results.Count >= top)
                {
                    return results;
                }
            }
        }
        return results;
    }

    public async Task<int> TrimAsync(int keep, CancellationToken ct = default)
    {
        if (keep <= 0)
        {
            return 0;
        }
        var filter = $"PartitionKey eq '{LeaderboardEntity.PartitionAll}'";
        int kept = 0;
        int deleted = 0;
        await foreach (var entity in _table.QueryAsync<LeaderboardEntity>(filter, cancellationToken: ct).ConfigureAwait(false))
        {
            if (kept < keep)
            {
                kept++;
                continue;
            }
            try
            {
                await _table.DeleteEntityAsync(entity.PartitionKey, entity.RowKey, entity.ETag, ct).ConfigureAwait(false);
                deleted++;
            }
            catch (Azure.RequestFailedException)
            {
            }
        }
        return deleted;
    }

    public async Task<int> DeleteDailyPartitionsOlderThanAsync(
        int retentionDays,
        DateTimeOffset utcNow,
        CancellationToken ct = default)
    {
        if (retentionDays <= 0)
        {
            return 0;
        }

        var cutoffDate = DateOnly.FromDateTime(utcNow.UtcDateTime).AddDays(-retentionDays);
        var filter = "PartitionKey ge 'daily-' and PartitionKey lt 'daily.'";
        int deleted = 0;
        await foreach (var entity in _table.QueryAsync<LeaderboardEntity>(filter, cancellationToken: ct).ConfigureAwait(false))
        {
            if (!LeaderboardPartitions.TryParseDailyPartitionDate(entity.PartitionKey, out var date) || date >= cutoffDate)
            {
                continue;
            }

            try
            {
                await _table.DeleteEntityAsync(entity.PartitionKey, entity.RowKey, entity.ETag, ct).ConfigureAwait(false);
                deleted++;
            }
            catch (Azure.RequestFailedException)
            {
            }
        }
        return deleted;
    }
}
