namespace SubInvaders.Api.Storage;

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using SubInvaders.Api.Models;

public interface ILeaderboardRepository
{
    Task AddAsync(
        LeaderboardEntity entity,
        string partitionKey = LeaderboardEntity.PartitionAll,
        CancellationToken ct = default);

    Task<IReadOnlyList<LeaderboardEntity>> GetTopAsync(
        int top,
        string partitionKey = LeaderboardEntity.PartitionAll,
        CancellationToken ct = default);

    Task<int> TrimAsync(int keep, CancellationToken ct = default);

    Task<int> DeleteDailyPartitionsOlderThanAsync(
        int retentionDays,
        DateTimeOffset utcNow,
        CancellationToken ct = default);
}

public static class LeaderboardPartitions
{
    public const string DailyPrefix = "daily-";

    private static readonly Regex UtcDatePattern = new(@"^\d{4}-\d{2}-\d{2}$", RegexOptions.CultureInvariant);

    public static bool IsUtcDate(string? utcDate) =>
        !string.IsNullOrEmpty(utcDate) &&
        UtcDatePattern.IsMatch(utcDate) &&
        DateOnly.TryParseExact(utcDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    public static bool TryParseDailyPartitionDate(string? partitionKey, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrEmpty(partitionKey) || !partitionKey.StartsWith(DailyPrefix, StringComparison.Ordinal))
        {
            return false;
        }
        var suffix = partitionKey[DailyPrefix.Length..];
        return IsUtcDate(suffix) &&
            DateOnly.TryParseExact(suffix, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }

    public static string DailyPartition(string utcDate) => $"{DailyPrefix}{utcDate}";
}
