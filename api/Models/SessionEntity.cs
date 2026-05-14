namespace SubInvaders.Api.Models;

using System;
using Azure;
using Azure.Data.Tables;

public sealed class SessionEntity : ITableEntity
{
    public string PartitionKey { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public string Nonce { get; set; } = string.Empty;
    public DateTimeOffset StartedAt { get; set; }
    public bool Consumed { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }

    public static string PartitionKeyFor(DateTimeOffset startedAtUtc) =>
        startedAtUtc.UtcDateTime.ToString("yyyyMMdd");
}
