/**
 * 用于测试应用初始化的独立文件
 */
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  console.log('开始测试NestJS应用初始化...');
  
  try {
    // 检查关键依赖是否可用
    console.log('验证关键依赖:');
    ['@nestjs/core', '@nestjs/common', '@nestjs/platform-express', '@nestjs/config', 'express', 'ethers'].forEach(dep => {
      try {
        require(dep);
        console.log(`✓ ${dep} 可用`);
      } catch (e) {
        console.error(`✗ ${dep} 不可用: ${e.message}`);
      }
    });
    
    console.log('创建Express应用...');
    const expressApp = express();
    
    console.log('创建NestJS应用...');
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      logger: ['error', 'warn', 'log', 'debug'],
    });
    
    console.log('启用CORS...');
    app.enableCors();
    
    console.log('初始化应用...');
    await app.init();
    
    console.log('✅ 应用初始化测试成功');
    
    // 清理资源
    await app.close();
    console.log('应用已关闭');
  } catch (error) {
    console.error('❌ 应用初始化测试失败:', error);
  }
}

// 直接执行
bootstrap().catch(err => {
  console.error('执行bootstrap函数时出错:', err);
  process.exit(1);
});
