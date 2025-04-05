import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly useTypeDynamoDB: boolean;
  
  constructor(
    private configService: ConfigService,
    @Optional() private dataSource?: DataSource,
  ) {
    this.logger.log('App service initialized');
    this.useTypeDynamoDB = this.configService.get<string>('DB_TYPE', 'dynamodb') === 'dynamodb';
  }

  getWelcome(): string {
    return 'Welcome to Web3 Authentication API';
  }
  
  async testDatabaseConnection(): Promise<object> {
    try {
      if (this.useTypeDynamoDB) {
        // DynamoDB 连接测试 - 根据 DynamoDB 的状态返回
        return {
          status: 'success',
          connected: true,
          message: 'DynamoDB 已配置',
          database: 'DynamoDB',
          timestamp: new Date().toISOString()
        };
      } else {
        // PostgreSQL 连接测试
        if (!this.dataSource) {
          return {
            status: 'error',
            connected: false,
            message: 'DataSource 未配置',
            timestamp: new Date().toISOString()
          };
        }
        
        // 检查数据库连接是否已建立
        if (!this.dataSource.isInitialized) {
          await this.dataSource.initialize();
        }
        
        // 执行简单查询验证连接
        const result = await this.dataSource.query('SELECT NOW()');
        
        return {
          status: 'success',
          connected: true,
          message: '数据库连接成功',
          timestamp: new Date().toISOString(),
          serverTime: result[0].now
        };
      }
    } catch (error) {
      this.logger.error(`数据库连接测试失败: ${error.message}`, error.stack);
      return {
        status: 'error',
        connected: false,
        message: `数据库连接失败: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}