import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { Web3Module } from './web3/web3.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { DynamoDBModule } from './dynamodb/dynamodb.module';
import { CoursesModule } from './courses/courses.module';
import { S3Module } from './utils/s3/s3.module';

@Module({
  imports: [
    // 配置模块，用于读取环境变量
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // DynamoDB 模块
    DynamoDBModule,
    
    // S3 模块
    S3Module,
    
    // 按照依赖关系导入模块
    Web3Module,
    UsersModule.forRoot(),
    AuthModule,
    CoursesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    AppService,
  ],
})
export class AppModule {}