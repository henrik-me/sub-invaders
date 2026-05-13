namespace SubInvaders.Api.Storage;

using System;
using System.Collections.Concurrent;
using Azure.Data.Tables;

public sealed class AzureTableClientFactory : ITableClientFactory
{
    private readonly TableServiceClient _service;
    private readonly ConcurrentDictionary<string, TableClient> _cache = new(StringComparer.Ordinal);
    private readonly bool _ensureCreated;

    public AzureTableClientFactory(string connectionString, bool ensureCreated = true)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentException("connectionString is required", nameof(connectionString));
        }
        _service = new TableServiceClient(connectionString);
        _ensureCreated = ensureCreated;
    }

    public TableClient GetClient(string tableName)
    {
        if (string.IsNullOrWhiteSpace(tableName))
        {
            throw new ArgumentException("tableName is required", nameof(tableName));
        }
        return _cache.GetOrAdd(tableName, name =>
        {
            var client = _service.GetTableClient(name);
            if (_ensureCreated)
            {
                client.CreateIfNotExists();
            }
            return client;
        });
    }
}
