import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { DynamoDBModule } from '../dynamodb/dynamodb.module';
import { CourseDynamoRepository } from './repositories/course.dynamo.repository';
import { CourseRepositoryAdapter } from './adapters/course.repository.adapter';
import { S3Module } from '../utils/s3/s3.module';
import { Web3Module } from '../web3/web3.module';
import { CourseContractService } from '../web3/services/course-contract.service';

@Module({
  imports: [
    DynamoDBModule,
    ConfigModule,
    S3Module,
    Web3Module
  ],
  controllers: [CoursesController],
  providers: [
    CoursesService,
    CourseDynamoRepository,
    CourseRepositoryAdapter,
    CourseContractService,
    ConfigService
  ],
  exports: [CoursesService],
})
export class CoursesModule {}
