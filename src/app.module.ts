import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { Web3Module } from './web3/web3.module';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/users.entity';
import { UserSession } from './users/entities/user-session.entity';

@Module({
  imports: [
    // 配置模块，用于读取环境变量
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // 数据库连接配置
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'senmu'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'postgres'),
        entities: [User, UserSession],
        synchronize: configService.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    
    // JWT模块配置
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '7d',
        },
      }),
      inject: [ConfigService],
    }),
    
    // 重要：调整模块导入顺序，首先导入基础模块
    Web3Module,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}