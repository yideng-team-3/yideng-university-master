import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  
  constructor(
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {
    this.logger.log('App service initialized');
  }

  getWelcome(): string {
    return 'Welcome to Web3 Authentication API';
  }
  
  getAppInfo(): object {
    return {
      name: 'Web3 Auth API',
      version: '1.0.0',
      environment: this.configService.get('NODE_ENV', 'development'),
      supportedChains: this.getSupportedChains(),
      supportedWallets: ['MetaMask', 'WalletConnect'],
      timestamp: new Date().toISOString()
    };
  }

  private getSupportedChains(): string[] {
    const chains = this.configService.get('SUPPORTED_CHAINS', 'ethereum');
    return chains.split(',').map(chain => chain.trim());
  }
  
  healthCheck(): object {
    // 简单健康检查
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
  
  formatSignatureMessage(nonce: string): string {
    const appName = this.configService.get('APP_NAME', 'My Web3 App');
    return `Sign this message to verify your identity on ${appName}: ${nonce}`;
  }
  
  validateEthereumAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  async testDatabaseConnection(): Promise<object> {
    try {
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