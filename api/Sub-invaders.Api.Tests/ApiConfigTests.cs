namespace SubInvaders.Api.Tests;

using SubInvaders.Api;
using Xunit;

[Collection(FeatureFlagTestCollection.Name)]
public class ApiConfigTests
{
    [Fact]
    public void CS12_Score_options_use_daily_multiplier_default_and_env_override()
    {
        using var multiplier = new EnvironmentVariableScope("DAILY_SCORE_MULTIPLIER_CAP", null);
        Assert.Equal(4, ApiConfig.BuildScoreOptionsFromEnvironment().DailyScoreMultiplierCap);

        using var overrideValue = new EnvironmentVariableScope("DAILY_SCORE_MULTIPLIER_CAP", "7");
        Assert.Equal(7, ApiConfig.BuildScoreOptionsFromEnvironment().DailyScoreMultiplierCap);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-3")]
    [InlineData("abc")]
    public void CS12_Score_options_invalid_daily_multiplier_falls_back(string value)
    {
        using var multiplier = new EnvironmentVariableScope("DAILY_SCORE_MULTIPLIER_CAP", value);
        Assert.Equal(4, ApiConfig.BuildScoreOptionsFromEnvironment().DailyScoreMultiplierCap);
    }

    [Fact]
    public void CS12_Cleanup_options_use_daily_retention_default_and_env_override()
    {
        using var retention = new EnvironmentVariableScope("DAILY_LEADERBOARD_RETENTION_DAYS", null);
        Assert.Equal(30, ApiConfig.BuildCleanupOptionsFromEnvironment().DailyLeaderboardRetentionDays);

        using var overrideValue = new EnvironmentVariableScope("DAILY_LEADERBOARD_RETENTION_DAYS", "45");
        Assert.Equal(45, ApiConfig.BuildCleanupOptionsFromEnvironment().DailyLeaderboardRetentionDays);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-3")]
    [InlineData("abc")]
    public void CS12_Cleanup_options_invalid_retention_falls_back(string value)
    {
        using var retention = new EnvironmentVariableScope("DAILY_LEADERBOARD_RETENTION_DAYS", value);
        Assert.Equal(30, ApiConfig.BuildCleanupOptionsFromEnvironment().DailyLeaderboardRetentionDays);
    }
}
