namespace SubInvaders.Api;

using System;

internal static class ApiConfig
{
    public static ScoreOptions BuildScoreOptionsFromEnvironment(Func<DateTimeOffset>? utcNow = null) => new()
    {
        MaxScorePerSecond = ParsePositiveInt(Environment.GetEnvironmentVariable("MAX_SCORE_PER_SECOND"), 50),
        DailyScoreMultiplierCap = ParsePositiveInt(Environment.GetEnvironmentVariable("DAILY_SCORE_MULTIPLIER_CAP"), 4),
        UtcNow = utcNow ?? (() => DateTimeOffset.UtcNow),
    };

    public static CleanupOptions BuildCleanupOptionsFromEnvironment() => new()
    {
        DailyLeaderboardRetentionDays = ParsePositiveInt(Environment.GetEnvironmentVariable("DAILY_LEADERBOARD_RETENTION_DAYS"), 30),
    };

    public static int ParsePositiveInt(string? value, int fallback)
    {
        if (int.TryParse(value, out var parsed) && parsed > 0)
        {
            return parsed;
        }
        return fallback;
    }
}
