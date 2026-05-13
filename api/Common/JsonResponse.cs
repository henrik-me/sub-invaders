namespace SubInvaders.Api.Common;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker.Http;

public static class JsonResponse
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };

    public static async Task<HttpResponseData> Write<T>(
        HttpRequestData req,
        HttpStatusCode status,
        T body)
    {
        var response = req.CreateResponse(status);
        response.Headers.Add("Content-Type", "application/json; charset=utf-8");
        response.Headers.Add("Cache-Control", "no-store");
        var json = JsonSerializer.Serialize(body, Options);
        await response.WriteStringAsync(json).ConfigureAwait(false);
        return response;
    }

    public static Task<HttpResponseData> Error(
        HttpRequestData req,
        HttpStatusCode status,
        string code,
        string message)
    {
        return Write(req, status, new ErrorBody(code, message));
    }

    public sealed record ErrorBody(string Error, string Message);
}
