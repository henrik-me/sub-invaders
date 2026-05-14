namespace SubInvaders.Api.Storage;

using System.Collections.Generic;
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
}

public static class LeaderboardPartitions
{
    private static readonly Regex UtcDatePattern = new(@"^\d{4}-\d{2}-\d{2}$", RegexOptions.CultureInvariant);

    public static bool IsUtcDate(string? utcDate) =>
        !string.IsNullOrEmpty(utcDate) && UtcDatePattern.IsMatch(utcDate);

    public static string DailyPartition(string utcDate) => $"daily-{utcDate}";
}
