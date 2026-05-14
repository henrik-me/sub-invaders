namespace SubInvaders.Api.Storage;

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using SubInvaders.Api.Models;

public interface ILeaderboardRepository
{
    Task AddAsync(LeaderboardEntity entity, CancellationToken ct = default);
    Task<IReadOnlyList<LeaderboardEntity>> GetTopAsync(int top, CancellationToken ct = default);
    Task<int> TrimAsync(int keep, CancellationToken ct = default);
}
