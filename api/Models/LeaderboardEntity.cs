namespace SubInvaders.Api.Models;

using System;
using System.Globalization;
using Azure;
using Azure.Data.Tables;

public sealed class LeaderboardEntity : ITableEntity
{
    public const string PartitionAll = "all";
    public const int MaxScore = 99_999_999;

    public string PartitionKey { get; set; } = PartitionAll;
    public string RowKey { get; set; } = string.Empty;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }

    public int Score { get; set; }
    public DateTimeOffset FinishedAt { get; set; }
    public string SessionId { get; set; } = string.Empty;

    public static string FormatRowKey(int score, Guid submissionId)
    {
        var clamped = Math.Clamp(score, 0, MaxScore);
        var inverted = (MaxScore - clamped).ToString("D8", CultureInfo.InvariantCulture);
        return $"{inverted}_{submissionId:N}";
    }
}
