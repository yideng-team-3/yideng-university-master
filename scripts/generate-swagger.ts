import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 导出Swagger文档脚本
 * 使用方式: npm run swagger:generate
 */
async function generateSwaggerDoc() {
  // 创建一个独立的应用实例
  const app = await NestFactory.create(AppModule);

  // Swagger文档配置
  const config = new DocumentBuilder()
    .setTitle('Web3 University API')
    .setDescription('Web3大学平台API文档')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', '认证相关')
    .addTag('users', '用户相关')
    .addTag('courses', '课程相关')
    .build();

  // 创建文档
  const document = SwaggerModule.createDocument(app, config);

  // 确保docs目录存在
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // 将Swagger文档保存为JSON文件
  fs.writeFileSync(
    path.join(docsDir, 'swagger-spec.json'),
    JSON.stringify(document, null, 2)
  );

  // 同时生成YAML格式（需要额外安装js-yaml包）
  // const yaml = require('js-yaml');
  // fs.writeFileSync(
  //   path.join(docsDir, 'swagger-spec.yaml'),
  //   yaml.dump(document)
  // );

  console.log('Swagger文档已成功导出到:');
  console.log('- docs/swagger-spec.json');
  // console.log('- docs/swagger-spec.yaml');

  await app.close();
}

// 执行脚本
generateSwaggerDoc();
