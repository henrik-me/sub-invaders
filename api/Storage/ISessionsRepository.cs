namespace SubInvaders.Api.Storage;

using System;
using System.Threading;
using System.Threading.Tasks;
using SubInvaders.Api.Models;

public interface ISessionsRepository
{
    Task CreateAsync(SessionEntity entity, CancellationToken ct = default);
    Task<SessionEntity?> GetAsync(string partitionKey, string sessionId, CancellationToken ct = default);
    Task<SessionEntity?> FindAcrossPartitionsAsync(string sessionId, CancellationToken ct = default);
    Task<bool> TryConsumeAsync(SessionEntity entity, CancellationToken ct = default);
    Task DeleteOlderThanAsync(DateTimeOffset cutoffUtc, CancellationToken ct = default);
}
