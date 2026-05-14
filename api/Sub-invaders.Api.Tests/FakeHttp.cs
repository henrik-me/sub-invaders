namespace SubInvaders.Api.Tests;

using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

internal sealed class FakeFunctionContext : FunctionContext
{
    public override string InvocationId => "test-invocation";
    public override string FunctionId => "test-function";
    public override TraceContext TraceContext => null!;
    public override BindingContext BindingContext => null!;
    public override RetryContext RetryContext => null!;
    public override IServiceProvider InstanceServices { get; set; } = null!;
    public override FunctionDefinition FunctionDefinition => null!;
    public override System.Collections.Generic.IDictionary<object, object> Items { get; set; } =
        new System.Collections.Generic.Dictionary<object, object>();
    public override IInvocationFeatures Features => null!;
}

internal sealed class FakeHttpRequestData : HttpRequestData
{
    private readonly Stream _body;
    private readonly Uri _url;
    private readonly HttpHeadersCollection _headers;
    private readonly string _method;

    public FakeHttpRequestData(string method, string url, string? bodyText = null,
        System.Collections.Generic.Dictionary<string, string>? headers = null)
        : base(new FakeFunctionContext())
    {
        _method = method;
        _url = new Uri(url);
        _body = bodyText is null ? Stream.Null : new MemoryStream(Encoding.UTF8.GetBytes(bodyText));
        _headers = new HttpHeadersCollection();
        if (headers is not null)
        {
            foreach (var kv in headers)
            {
                _headers.Add(kv.Key, kv.Value);
            }
        }
    }

    public override Stream Body => _body;
    public override HttpHeadersCollection Headers => _headers;
    public override System.Collections.Generic.IReadOnlyCollection<IHttpCookie> Cookies =>
        System.Array.Empty<IHttpCookie>();
    public override Uri Url => _url;
    public override System.Collections.Generic.IEnumerable<ClaimsIdentityHolder> Identities =>
        System.Array.Empty<ClaimsIdentityHolder>();
    public override string Method => _method;

    public override HttpResponseData CreateResponse() => new FakeHttpResponseData(FunctionContext);
}

internal sealed class ClaimsIdentityHolder : System.Security.Claims.ClaimsIdentity { }

internal sealed class FakeHttpResponseData : HttpResponseData
{
    private Stream _body = new MemoryStream();
    public FakeHttpResponseData(FunctionContext ctx) : base(ctx)
    {
        Headers = new HttpHeadersCollection();
        Cookies = new FakeHttpCookies();
    }
    public override HttpStatusCode StatusCode { get; set; }
    public override HttpHeadersCollection Headers { get; set; }
    public override Stream Body { get => _body; set => _body = value; }
    public override HttpCookies Cookies { get; }

    public string ReadBodyAsString()
    {
        if (_body is MemoryStream ms)
        {
            return Encoding.UTF8.GetString(ms.ToArray());
        }
        _body.Position = 0;
        using var reader = new StreamReader(_body, Encoding.UTF8, leaveOpen: true);
        return reader.ReadToEnd();
    }

    public T? ReadBodyAs<T>()
    {
        var text = ReadBodyAsString();
        if (string.IsNullOrEmpty(text)) return default;
        return JsonSerializer.Deserialize<T>(text, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    }
}

internal sealed class FakeHttpCookies : HttpCookies
{
    public override void Append(string name, string value) { }
    public override void Append(IHttpCookie cookie) { }
    public override IHttpCookie CreateNew() => throw new NotImplementedException();
}
