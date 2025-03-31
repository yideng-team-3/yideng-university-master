import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/users.entity';
import { DynamoDBModule } from '../dynamodb/dynamodb.module'; 
import { UserDynamoRepository } from './repositories/user.dynamo.repository';
import { UserRepositoryAdapter } from './adapters/user.repository.adapter';

@Module({})
export class UsersModule {
  static forRoot(): DynamicModule {
    const dbType = process.env.DB_TYPE || 'dynamodb';
    const isServerless = process.env.IS_OFFLINE || process.env.AWS_LAMBDA_FUNCTION_NAME;
    const useDynamoDB = dbType === 'dynamodb' || !!isServerless;
    
    return {
      module: UsersModule,
      imports: [
        // 有条件地导入 TypeOrmModule
        ...(useDynamoDB ? [] : [TypeOrmModule.forFeature([User])]),
        DynamoDBModule,
        ConfigModule,
      ],
      controllers: [UsersController],
      providers: [
        {
          provide: 'DATABASE_TYPE',
          useValue: useDynamoDB ? 'dynamodb' : 'postgres'
        },
        UsersService,
        UserDynamoRepository,
        UserRepositoryAdapter,
      ],
      exports: [UsersService],
    };
  }
}
