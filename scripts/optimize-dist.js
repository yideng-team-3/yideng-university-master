/**
 * 优化dist目录脚本 - 专注于减小Lambda部署包大小
 */
const fs = require('fs');
const path = require('path');

// 主函数
function main() {
  console.log('🔧 开始优化dist目录...');
  
  const distDir = path.join(__dirname, '../dist');
  
  // 检查dist目录是否存在
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist目录不存在');
    process.exit(1);
  }
  
  // 确保lambda.js入口文件存在
  ensureLambdaEntry(distDir);
  
  // 移除大型非必要文件
  cleanupDist(distDir);
  
  // 验证关键文件
  validateDist(distDir);
  
  // 输出包大小统计
  reportSize(distDir);
  
  console.log('✅ dist目录优化完成');
}

// 确保lambda.js入口文件存在
function ensureLambdaEntry(distDir) {
  const lambdaPath = path.join(distDir, 'lambda.js');
  
  if (!fs.existsSync(lambdaPath)) {
    console.warn('⚠️ 未找到lambda.js入口文件，检查是否在src中创建了lambda.ts');
    
    // 如果src中有lambda.ts但未编译，提示错误
    if (fs.existsSync(path.join(__dirname, '../src/lambda.ts'))) {
      console.error('❌ 源码中存在lambda.ts，但编译后的文件不存在，检查编译配置');
    } else {
      console.log('📝 创建lambda.js入口文件...');
      
      const lambdaContent = `
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;

// 定义程序查找路径
process.env.NODE_PATH = process.env.NODE_PATH || '/var/task:/opt/nodejs:/opt/nodejs/node_modules';

// 延迟加载依赖，提高冷启动性能
const getNestFactory = () => require('@nestjs/core').NestFactory;
const getExpressAdapter = () => require('@nestjs/platform-express').ExpressAdapter;
const getAppModule = () => require('./app.module').AppModule;
const getExpress = () => require('express');
const getServerlessExpress = () => require('aws-serverless-express');

let cachedServer;

async function bootstrapServer() {
  if (!cachedServer) {
    try {
      const express = getExpress();
      const expressApp = express();
      
      const nestFactory = getNestFactory();
      const expressAdapter = getExpressAdapter();
      const appModule = getAppModule();
      
      const app = await nestFactory.create(appModule, new expressAdapter(expressApp), {
        logger: ['error', 'warn', 'log', process.env.NODE_ENV === 'dev' ? 'debug' : undefined],
      });
      
      app.enableCors();
      await app.init();
      
      const serverlessExpress = getServerlessExpress();
      cachedServer = serverlessExpress.createServer(expressApp);
      
      console.log('NestJS应用已初始化');
    } catch (error) {
      console.error('初始化失败:', error);
      throw error;
    }
  }
  return cachedServer;
}

const handler = async (event, context) => {
  // 保持Lambda处理程序活动直到响应完成
  context.callbackWaitsForEmptyEventLoop = false;
  
  console.log('Lambda运行环境:', {
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
    memoryLimitInMB: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
  });
  
  try {
    const server = await bootstrapServer();
    const serverlessExpress = getServerlessExpress();
    return serverlessExpress.proxy(server, event, context);
  } catch (error) {
    console.error('处理请求失败:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '服务器内部错误' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

exports.handler = handler;
      `;
      
      fs.writeFileSync(lambdaPath, lambdaContent);
      console.log('✅ 已创建lambda.js入口文件');
    }
  } else {
    console.log('✅ lambda.js入口文件已存在');
  }
}

// 清理dist目录中的不必要文件
function cleanupDist(distDir) {
  console.log('🧹 清理dist目录...');
  
  // 要删除的文件模式
  const filesToRemove = [
    '**/*.spec.js',
    '**/*.test.js',
    '**/*.d.ts',
    '**/*.js.map',
  ];
  
  // 遍历并删除文件
  let removedCount = 0;
  for (const pattern of filesToRemove) {
    // 这里简化实现，实际项目中可以使用glob模块进行模式匹配
    if (pattern === '**/*.js.map') {
      // 简单处理源映射文件
      const mapFiles = findFiles(distDir, '.js.map');
      for (const file of mapFiles) {
        fs.unlinkSync(file);
        removedCount++;
      }
    }
    // 处理其他文件模式...
  }
  
  console.log(`✅ 已删除${removedCount}个不必要文件`);
}

// 辅助函数：递归查找特定扩展名的文件
function findFiles(dir, extension) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extension));
    } else if (file.endsWith(extension)) {
      results.push(filePath);
    }
  }
  
  return results;
}

// 验证dist目录的完整性
function validateDist(distDir) {
  console.log('🔍 验证dist目录的完整性...');
  
  // 必需的文件
  const requiredFiles = [
    'lambda.js',
    'app.module.js',
    'users/users.module.js',
    'auth/auth.module.js',
    'dynamodb/dynamodb.module.js'
  ];
  
  let allPresent = true;
  for (const file of requiredFiles) {
    const filePath = path.join(distDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ 缺少关键文件: ${file}`);
      allPresent = false;
    }
  }
  
  if (allPresent) {
    console.log('✅ 所有关键文件都存在');
  } else {
    console.error('❌ 部分关键文件缺失，部署可能会失败');
  }
}

// 报告dist目录大小
function reportSize(distDir) {
  console.log('📊 生成大小报告...');
  
  // 获取文件夹总大小
  const getTotalSize = (dir) => {
    let total = 0;
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        total += getTotalSize(itemPath);
      } else {
        total += stats.size;
      }
    }
    
    return total;
  };
  
  const totalBytes = getTotalSize(distDir);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  
  console.log(`总大小: ${totalMB} MB`);
  
  // Lambda部署包大小限制
  if (totalMB > 50) {
    console.warn('⚠️ 警告: 部署包超过50MB，可能无法通过控制台直接上传');
  }
}

// 执行主函数
main();
