import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  DynamoDBClient,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  QueryCommand, 
  ScanCommand, 
  UpdateCommand, 
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';
import { fromSSO } from '@aws-sdk/credential-providers'; // 导入 SSO 凭证提供者


@Injectable()
export class DynamoDBService implements OnModuleInit {
  private readonly logger = new Logger(DynamoDBService.name);
  private ddbClient: DynamoDBClient;
  private documentClient: DynamoDBDocumentClient;
  
  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-2');
    this.logger.log(`使用区域: ${region}, 离线模式: ${process.env.IS_OFFLINE || false}`);
    
    // 创建 DynamoDB 客户端
    if (process.env.IS_OFFLINE === 'true') {
      // 本地开发环境
      this.logger.log('连接到本地 DynamoDB');
      this.ddbClient = new DynamoDBClient({
        region,
        endpoint: 'http://localhost:8000',
        credentials: {
          accessKeyId: 'local',
          secretAccessKey: 'local'
        }
      });
    } else {
      // 使用 AWS 凭证链，支持 SSO 登录
      this.logger.log('连接到 AWS DynamoDB');
      this.ddbClient = new DynamoDBClient({
        region,
      });
    }
    
    // 创建 DynamoDB Document 客户端
    this.documentClient = DynamoDBDocumentClient.from(this.ddbClient, {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
      },
    });
  }
  
  async onModuleInit() {
    try {
      // 在初始化时检查连接状态
      const command = new ListTablesCommand({});
      const response = await this.ddbClient.send(command);
      this.logger.log(`DynamoDB 连接成功，共 ${response.TableNames?.length} 个表`);
    } catch (error) {
      this.logger.error('DynamoDB 连接失败', error);
      if (process.env.NODE_ENV === 'production') {
        throw error; // 在生产环境，如果连接失败则抛出错误
      }
    }
  }
  
  // 获取文档客户端
  getDocumentClient(): DynamoDBDocumentClient {
    return this.documentClient;
  }
  
  // 通用的 CRUD 操作
  async getItem(tableName: string, key: Record<string, any>) {
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    });
    const response = await this.documentClient.send(command);
    return response.Item;
  }
  
  async putItem(tableName: string, item: Record<string, any>) {
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    });
    return this.documentClient.send(command);
  }
  
  async updateItem(
    tableName: string, 
    key: Record<string, any>, 
    updateExpression: string, 
    expressionAttributeValues: Record<string, any>,
    expressionAttributeNames?: Record<string, string>
  ) {
    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    });
    return this.documentClient.send(command);
  }
  
  async deleteItem(tableName: string, key: Record<string, any>) {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key,
    });
    return this.documentClient.send(command);
  }
  
  async query(
    tableName: string,
    keyConditionExpression: string,
    expressionAttributeValues: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    indexName?: string
  ) {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      IndexName: indexName,
    });
    return this.documentClient.send(command);
  }
  
  async scan(
    tableName: string,
    filterExpression?: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>
  ) {
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
    });
    return this.documentClient.send(command);
  }
}
