import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../../dynamodb/dynamodb.service';
import { DynamoUser } from '../models/user.dynamo.model';

@Injectable()
export class UserDynamoRepository {
  private readonly logger = new Logger(UserDynamoRepository.name);
  private readonly tableName: string;
  
  constructor(
    private dynamoDBService: DynamoDBService,
    private configService: ConfigService,
  ) {
    // 获取用户表名
    this.tableName = this.configService.get<string>(
      'DYNAMODB_USERS_TABLE',
      'web3-university-dev-users'
    );
  }
  
  // 创建用户
  async create(userData: Partial<DynamoUser>): Promise<DynamoUser> {
    const user = new DynamoUser({
      ...userData,
      id: userData.id || uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    await this.dynamoDBService.putItem(this.tableName, user.toDynamoItem());
    return user;
  }
  
  // 通过ID查找用户
  async findOne(id: string): Promise<DynamoUser | null> {
    const result = await this.dynamoDBService.getItem(this.tableName, { id });
    return DynamoUser.fromDynamoItem(result);
  }
  
  // 通过钱包地址查找用户
  async findByWalletAddress(walletAddress: string): Promise<DynamoUser | null> {
    const result = await this.dynamoDBService.query(
      this.tableName,
      'walletAddress = :walletAddress',
      { ':walletAddress': walletAddress },
      undefined,
      'walletAddressIndex'
    );
    
    if (!result.Items || result.Items.length === 0) {
      return null;
    }
    
    return DynamoUser.fromDynamoItem(result.Items[0]);
  }
  
  // 查找所有用户
  async findAll(limit?: number, lastEvaluatedKey?: Record<string, any>): Promise<{ users: DynamoUser[], lastEvaluatedKey?: Record<string, any> }> {
    const result = await this.dynamoDBService.scan(
      this.tableName,
      undefined,
      undefined,
      undefined
    );
    
    const users = (result.Items || []).map(item => DynamoUser.fromDynamoItem(item));
    
    return {
      users: users.filter(user => user !== null) as DynamoUser[],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }
  
  // 更新用户
  async update(id: string, userData: Partial<DynamoUser>): Promise<DynamoUser | null> {
    // 检查用户是否存在
    const existingUser = await this.findOne(id);
    if (!existingUser) {
      throw new NotFoundException(`用户ID为 ${id} 的记录不存在`);
    }
    
    // 构建更新表达式
    let updateExpression = 'SET';
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};
    
    // 创建一个新对象，包含用户数据和更新时间
    const updatedData = {
      ...userData,
      updatedAt: new Date().toISOString()
    };
    
    // 动态构建更新表达式
    let isFirst = true;
    Object.keys(updatedData).forEach((key) => {
      if (key !== 'id' && key !== 'createdAt' && updatedData[key] !== undefined) {
        updateExpression += isFirst ? ` #${key} = :${key}` : `, #${key} = :${key}`;
        expressionAttributeValues[`:${key}`] = updatedData[key];
        expressionAttributeNames[`#${key}`] = key;
        isFirst = false;
      }
    });
    
    // 执行更新
    const result = await this.dynamoDBService.updateItem(
      this.tableName,
      { id },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );
    
    return DynamoUser.fromDynamoItem(result.Attributes);
  }
  
  // 保存用户（更新或创建）
  async save(user: Partial<DynamoUser>): Promise<DynamoUser | null> {
    if (user.id) {
      // 如果有ID，则更新
      return this.update(user.id, user);
    } else {
      // 如果没有ID，则创建
      return this.create(user);
    }
  }
  
  // 删除用户
  async remove(id: string): Promise<void> {
    await this.dynamoDBService.deleteItem(this.tableName, { id });
  }
}
