import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as express from 'express';
import * as serverlessExpress from 'aws-serverless-express';
import { Context, Handler } from 'aws-lambda';

// 提前设置环境变量，确保在任何导入之前就完成设置
console.log('⚡ Lambda 冷启动 - 初始化环境...');
process.env.DB_TYPE = process.env.DB_TYPE || 'dynamodb';
process.env.NODE_PATH = process.env.NODE_PATH || '/var/task:/opt/nodejs/node_modules:/opt/nodejs:/var/runtime/node_modules';

// 重新计算模块搜索路径 - 必须在导入其他模块前执行
require('module').Module._initPaths();

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('捕获到未处理的异常:', error);
  // 不要在生产环境中退出进程，让Lambda重启处理
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('捕获到未处理的Promise拒绝:', reason);
});

// 打印环境信息
console.log('环境配置:', {
  NODE_ENV: process.env.NODE_ENV,
  STAGE: process.env.STAGE,
  DB_TYPE: process.env.DB_TYPE,
  NODE_PATH: process.env.NODE_PATH,
  modulePaths: module.paths
});

// 避免全局变量初始化过多，只初始化必要内容
let cachedServer: any;
let isInitializing = false;
let initializationError: Error | null = null;

// 简化的NestJS应用初始化
async function bootstrapServer(): Promise<any> {
  if (cachedServer) {
    return cachedServer;
  }
  
  if (initializationError) {
    throw initializationError;
  }
  
  if (isInitializing) {
    console.log('应用正在初始化中，等待初始化完成...');
    // 等待初始化完成
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (initializationError) {
      throw initializationError;
    }
    
    return cachedServer;
  }
  
  isInitializing = true;
  
  try {
    console.log('开始初始化NestJS应用...');
    console.log('使用 DynamoDB 作为数据库');
    
    // 创建Express应用
    const expressApp = express();
    
    // 使用更简单的应用配置
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      // 只记录关键日志
      logger: ['error', 'warn', 'log'],
      // 禁用额外功能以减少启动时间
      bodyParser: true,
    });
    
    // 简化应用设置
    app.enableCors();
    
    // 初始化应用
    await app.init();
    console.log('NestJS应用初始化成功');
    
    // 创建serverless express应用
    cachedServer = serverlessExpress.createServer(expressApp);
    console.log('Serverless Express服务器创建成功');
    
    return cachedServer;
  } catch (error) {
    console.error('应用初始化过程中发生严重错误:', error);
    initializationError = error as Error;
    throw error;
  } finally {
    isInitializing = false;
  }
}

// Lambda处理函数 - 简化和加强错误处理
export const handler: Handler = async (event: any, context: Context) => {
  // 不要等待事件循环清空
  context.callbackWaitsForEmptyEventLoop = false;
  
  // 简化日志，避免过多输出
  console.log(`处理${event.httpMethod || 'unknown'}请求: ${event.path || '/'}`);
  
  try {
    // 获取或初始化服务器
    const server = await bootstrapServer();
    // 处理请求
    return serverlessExpress.proxy(server, event, context);
  } catch (error) {
    console.error('Lambda处理请求失败:', error);
    // 返回友好的错误响应
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'dev' ? (error as Error).message : '请稍后再试',
        requestId: context.awsRequestId
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
};
