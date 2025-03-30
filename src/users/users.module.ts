import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/users.entity';
import { UserSession } from './entities/user-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSession]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // 确保导出 UsersService
})
export class UsersModule {}
