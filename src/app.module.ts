import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { Web3Module } from './web3/web3.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { User } from './users/entities/users.entity';
import { DynamoDBModule } from './dynamodb/dynamodb.module';

@Module({
  imports: [
    // 配置模块，用于读取环境变量
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // 有条件地导入 TypeORM
    ...conditionalImports(),
    
    // DynamoDB 模块
    DynamoDBModule,
    
    // 按照依赖关系导入模块
    Web3Module,
    UsersModule.forRoot(),
    AuthModule,
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

// 根据配置决定是否加载 TypeORM
function conditionalImports() {
  // 如果是Serverless环境或明确指定使用DynamoDB，则不加载TypeORM
  if (process.env.DB_TYPE === 'dynamodb' || process.env.IS_OFFLINE || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.log('使用 DynamoDB 作为数据库');
    return [];
  }
  
  console.log('使用 PostgreSQL 作为数据库');
  return [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'senmu'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'postgres'),
        entities: [User],
        synchronize: configService.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
  ];
}