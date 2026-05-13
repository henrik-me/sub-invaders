namespace SubInvaders.Api;

using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using SubInvaders.Api.Common;
using SubInvaders.Api.Storage;

public class LeaderboardFunction
{
    private const int TopCount = 100;

    private readonly ILeaderboardRepository _leaderboard;

    public LeaderboardFunction(ILeaderboardRepository leaderboard)
    {
        _leaderboard = leaderboard;
    }

    [Function("Leaderboard")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "leaderboard")] HttpRequestData req)
    {
        var period = "all";
        var qs = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var raw = qs.Get("period");
        if (!string.IsNullOrWhiteSpace(raw))
        {
            period = raw.ToLowerInvariant();
        }

        if (period == "daily")
        {
            return await JsonResponse.Error(req, HttpStatusCode.NotImplemented, "not_implemented",
                "period=daily is reserved for CS04").ConfigureAwait(false);
        }
        if (period != "all")
        {
            return await JsonResponse.Error(req, HttpStatusCode.BadRequest, "invalid_period",
                "period must be 'all' or 'daily'").ConfigureAwait(false);
        }

        var rows = await _leaderboard.GetTopAsync(TopCount).ConfigureAwait(false);
        var body = rows
            .Select((r, i) => new LeaderboardRow(i + 1, r.Score, r.FinishedAt.UtcDateTime.ToString("o")))
            .ToArray();

        return await JsonResponse.Write(req, HttpStatusCode.OK, new LeaderboardBody(period, body)).ConfigureAwait(false);
    }

    public sealed record LeaderboardRow(int Rank, int Score, string FinishedAt);
    public sealed record LeaderboardBody(string Period, LeaderboardRow[] Entries);
}
