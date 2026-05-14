namespace SubInvaders.Api;

using System;
using System.Net;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using SubInvaders.Api.Common;
using SubInvaders.Api.Models;
using SubInvaders.Api.Storage;

public class SessionFunction
{
    private readonly ISessionsRepository _sessions;

    public SessionFunction(ISessionsRepository sessions)
    {
        _sessions = sessions;
    }

    [Function("Session")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "session")] HttpRequestData req)
    {
        var sessionId = Guid.NewGuid().ToString("D");
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var startedAt = DateTimeOffset.UtcNow;

        var entity = new SessionEntity
        {
            PartitionKey = SessionEntity.PartitionKeyFor(startedAt),
            RowKey = sessionId,
            Nonce = nonce,
            StartedAt = startedAt,
            Consumed = false,
        };

        await _sessions.CreateAsync(entity).ConfigureAwait(false);

        return await JsonResponse.Write(req, HttpStatusCode.OK, new SessionBody(
            sessionId,
            nonce,
            startedAt.UtcDateTime.ToString("o"))).ConfigureAwait(false);
    }

    public sealed record SessionBody(string SessionId, string Nonce, string StartedAt);
}
