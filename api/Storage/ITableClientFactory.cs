namespace SubInvaders.Api.Storage;

using Azure.Data.Tables;

public interface ITableClientFactory
{
    TableClient GetClient(string tableName);
}
