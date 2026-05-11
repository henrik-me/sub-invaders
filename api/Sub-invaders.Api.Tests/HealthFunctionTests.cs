using SubInvaders.Api;
using Xunit;

public class HealthFunctionTests
{
    [Fact]
    public void HealthResponseBody_IsExactlyStatusOk()
    {
        Assert.Equal("{\"status\":\"ok\"}", HealthFunction.ResponseBody);
    }
}
