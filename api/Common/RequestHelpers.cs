namespace SubInvaders.Api.Common;

using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker.Http;

public static class RequestHelpers
{
    public const int MaxBodyBytes = 1024;

    public static string ResolveClientIp(HttpRequestData req)
    {
        if (req.Headers.TryGetValues("X-Forwarded-For", out var fwd))
        {
            var first = fwd.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(first))
            {
                var token = first.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                    .FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(token))
                {
                    var portIdx = token.LastIndexOf(':');
                    if (portIdx > 0 && !token.Contains(']'))
                    {
                        token = token[..portIdx];
                    }
                    return token;
                }
            }
        }
        if (req.Headers.TryGetValues("X-Azure-ClientIP", out var azureIp))
        {
            var v = azureIp.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(v))
            {
                return v;
            }
        }
        return "unknown";
    }

    public static async Task<(bool Ok, string Body, string? Error)> ReadBodyBoundedAsync(
        HttpRequestData req,
        int maxBytes = MaxBodyBytes)
    {
        if (req.Body is null)
        {
            return (true, string.Empty, null);
        }
        using var ms = new MemoryStream();
        var buffer = new byte[1024];
        int read;
        int total = 0;
        while ((read = await req.Body.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false)) > 0)
        {
            total += read;
            if (total > maxBytes)
            {
                return (false, string.Empty, $"request body exceeds {maxBytes} bytes");
            }
            ms.Write(buffer, 0, read);
        }
        var text = System.Text.Encoding.UTF8.GetString(ms.ToArray());
        return (true, text, null);
    }
}
