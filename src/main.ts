import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 配置全局异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter());
  
  // 配置全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // 自动转换类型
      whitelist: true, // 过滤掉未定义的属性
      forbidNonWhitelisted: true, // 如果存在未定义的属性，则抛出错误
      disableErrorMessages: process.env.NODE_ENV === 'production', // 生产环境禁用详细错误消息
      validationError: {
        target: false, // 错误响应中不包含目标对象
        value: false, // 错误响应中不包含原始值
      },
    }),
  );
  
  // 配置 CORS - 确保在所有环境下启用CORS
  app.enableCors({
    origin: true, // 允许所有域的请求，生产环境中可以设置为特定域名
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With,X-HTTP-Method-Override',
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

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
    
  const document = SwaggerModule.createDocument(app, config);
  
  // 提供Swagger UI界面
  SwaggerModule.setup('api-docs', app, document);
  
  // 创建接口导出Swagger JSON
  app.use('/api-json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  });
  
  // 另一种方式：将文档导出到文件
  if (process.env.NODE_ENV === 'development') {
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
    
    console.log('Swagger文档已导出到 /docs/swagger-spec.json');
  }
  
  console.log(`Server is running on port ${process.env.PORT ?? 3001}`);
  await app.listen(process.env.PORT ?? 3001);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`Swagger文档可在以下地址访问:`);
    console.log(`- Swagger UI: http://localhost:${process.env.PORT ?? 3001}/api-docs`);
    console.log(`- Swagger JSON: http://localhost:${process.env.PORT ?? 3001}/api-json`);
  }
}
bootstrap();
