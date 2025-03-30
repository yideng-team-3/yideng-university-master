import { Global, Module } from '@nestjs/common';
import { Web3Controller } from './web3.controller';
import { Web3Service } from './web3.service';
import { UsersModule } from '../users/users.module';

@Global() // 使模块成为全局模块，可以在任何地方注入其提供的服务
@Module({
  imports: [UsersModule],
  controllers: [Web3Controller],
  providers: [Web3Service],
  exports: [Web3Service],
})
export class Web3Module {}
