import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 配置 CORS
  if (process.env.NODE_ENV === 'development') {
    app.enableCors({
      origin: true, // 允许所有域的请求，生产环境中应该限制为特定域名
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true, // 允许发送凭证(cookies)
      allowedHeaders: 'Content-Type, Accept, Authorization',
    });
  }
  
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
