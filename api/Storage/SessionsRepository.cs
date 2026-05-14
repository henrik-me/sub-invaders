namespace SubInvaders.Api.Storage;

using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Azure;
using Azure.Data.Tables;
using SubInvaders.Api.Models;

public sealed class SessionsRepository : ISessionsRepository
{
    private readonly TableClient _table;

    public SessionsRepository(ITableClientFactory factory)
    {
        _table = factory.GetClient(TableNames.Sessions);
    }

    public async Task CreateAsync(SessionEntity entity, CancellationToken ct = default)
    {
        await _table.AddEntityAsync(entity, ct).ConfigureAwait(false);
    }

    public async Task<SessionEntity?> GetAsync(string partitionKey, string sessionId, CancellationToken ct = default)
    {
        try
        {
            var resp = await _table.GetEntityAsync<SessionEntity>(partitionKey, sessionId, cancellationToken: ct).ConfigureAwait(false);
            return resp.Value;
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task<SessionEntity?> FindAcrossPartitionsAsync(string sessionId, CancellationToken ct = default)
    {
        var filter = $"RowKey eq '{sessionId.Replace("'", "''")}'";
        await foreach (var page in _table.QueryAsync<SessionEntity>(filter, cancellationToken: ct).AsPages(pageSizeHint: 1).ConfigureAwait(false))
        {
            var first = page.Values.FirstOrDefault();
            if (first is not null)
            {
                return first;
            }
        }
        return null;
    }

    public async Task<bool> TryConsumeAsync(SessionEntity entity, CancellationToken ct = default)
    {
        if (entity.Consumed)
        {
            return false;
        }
        entity.Consumed = true;
        entity.ConsumedAt = DateTimeOffset.UtcNow;
        try
        {
            await _table.UpdateEntityAsync(entity, entity.ETag, TableUpdateMode.Replace, ct).ConfigureAwait(false);
            return true;
        }
        catch (RequestFailedException ex) when (ex.Status == 412 || ex.Status == 409)
        {
            return false;
        }
    }

    public async Task DeleteOlderThanAsync(DateTimeOffset cutoffUtc, CancellationToken ct = default)
    {
        var iso = cutoffUtc.UtcDateTime.ToString("o");
        var filter = $"StartedAt lt datetime'{iso}'";
        await foreach (var entity in _table.QueryAsync<SessionEntity>(filter, cancellationToken: ct).ConfigureAwait(false))
        {
            try
            {
                await _table.DeleteEntityAsync(entity.PartitionKey, entity.RowKey, entity.ETag, ct).ConfigureAwait(false);
            }
            catch (RequestFailedException)
            {
            }
        }
    }
}
