import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/users.entity';
import { UserDynamoRepository } from '../repositories/user.dynamo.repository';
import { DynamoUser } from '../models/user.dynamo.model';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserRepositoryAdapter {
  private readonly useTypeDynamoDB: boolean;
  
  constructor(
    private configService: ConfigService,
    private userDynamoRepository: UserDynamoRepository,
    @Optional() @InjectRepository(User) private typeormRepository?: Repository<User>
  ) {
    // 通过配置决定使用哪种数据库
    this.useTypeDynamoDB = this.configService.get<string>('DB_TYPE', 'dynamodb') === 'dynamodb';
  }

  // 创建新用户
  async create(userData: Partial<User>): Promise<User> {
    if (this.useTypeDynamoDB) {
      const dynamoUser = await this.userDynamoRepository.create(this.convertToDynamoUser(userData));
      return this.convertToUser(dynamoUser);
    } else {
      if (!this.typeormRepository) {
        throw new Error('TypeORM 存储库未配置');
      }
      return this.typeormRepository.save(userData);
    }
  }

  // 通过ID查找用户
  async findOne(id: string): Promise<User | null> {
    if (this.useTypeDynamoDB) {
      const dynamoUser = await this.userDynamoRepository.findOne(id);
      return dynamoUser ? this.convertToUser(dynamoUser) : null;
    } else {
      if (!this.typeormRepository) {
        throw new Error('TypeORM 存储库未配置');
      }
      return this.typeormRepository.findOneBy({ id: id as any as number });
    }
  }

  // 通过钱包地址查找用户
  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    if (this.useTypeDynamoDB) {
      const dynamoUser = await this.userDynamoRepository.findByWalletAddress(walletAddress);
      return dynamoUser ? this.convertToUser(dynamoUser) : null;
    } else {
      if (!this.typeormRepository) {
        throw new Error('TypeORM 存储库未配置');
      }
      return this.typeormRepository.findOneBy({ walletAddress });
    }
  }

  // 查找所有用户
  async findAll(): Promise<User[]> {
    if (this.useTypeDynamoDB) {
      const { users } = await this.userDynamoRepository.findAll();
      return users.map(user => this.convertToUser(user));
    } else {
      if (!this.typeormRepository) {
        throw new Error('TypeORM 存储库未配置');
      }
      return this.typeormRepository.find();
    }
  }

  // 更新用户
  async update(id: string, userData: Partial<User>): Promise<User | null> {
    if (this.useTypeDynamoDB) {
      const dynamoUser = await this.userDynamoRepository.update(id, this.convertToDynamoUser(userData));
      return this.convertToUser(dynamoUser as DynamoUser);
    } else {
      if (!this.typeormRepository) {
        throw new Error('TypeORM 存储库未配置');
      }
      await this.typeormRepository.update(id, userData);
      return this.findOne(id);
    }
  }

  // 保存用户
  async save(user: Partial<User>): Promise<User | null> {
    if (this.useTypeDynamoDB) {
      const dynamoUser = await this.userDynamoRepository.save(this.convertToDynamoUser(user));
      return this.convertToUser(dynamoUser as DynamoUser);
    } else {
      if (!this.typeormRepository) {
        throw new Error('TypeORM 存储库未配置');
      }
      return this.typeormRepository.save(user);
    }
  }

  // 删除用户
  async remove(id: string): Promise<void> {
    if (this.useTypeDynamoDB) {
      await this.userDynamoRepository.remove(id);
    } else {
      if (!this.typeormRepository) {
        throw new Error('TypeORM 存储库未配置');
      }
      await this.typeormRepository.delete(id);
    }
  }

  // 将 User 转换为 DynamoUser
  private convertToDynamoUser(user: Partial<User>): Partial<DynamoUser> {
    // 提取非日期字段
    const { createdAt, updatedAt, lastLoginAt, ...rest } = user;
    
    // 基础字段转换
    // @ts-ignore
    const dynamoUser: Partial<DynamoUser> = { ...rest };
    
    // 处理日期转换
    if (createdAt instanceof Date) {
      dynamoUser.createdAt = createdAt.toISOString();
    }
    if (updatedAt instanceof Date) {
      dynamoUser.updatedAt = updatedAt.toISOString();
    }
    
    return dynamoUser;
  }

  // 将 DynamoUser 转换为 User
  private convertToUser(dynamoUser: DynamoUser): User {
    
    const user = new User();
    
    // 处理 ID 类型转换 (string -> number)
    if (dynamoUser.id && typeof dynamoUser.id === 'string') {
      try {
        // 尝试将 ID 转换为数字，但在 DynamoDB 模式下保留字符串
        user.id = this.useTypeDynamoDB ? dynamoUser.id as any : parseInt(dynamoUser.id);
      } catch (e) {
        // 如果无法转换，则保留原始值
        user.id = dynamoUser.id as any;
      }
    }
    
    // 复制其他属性
    Object.keys(dynamoUser).forEach(key => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'lastLoginAt') {
        user[key] = dynamoUser[key];
      }
    });
    
    // 处理日期转换
    if (dynamoUser.createdAt) {
      user.createdAt = new Date(dynamoUser.createdAt);
    }
    if (dynamoUser.updatedAt) {
      user.updatedAt = new Date(dynamoUser.updatedAt);
    }
    
    return user;
  }
}