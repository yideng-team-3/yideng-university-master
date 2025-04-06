import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBService } from '../../dynamodb/dynamodb.service';
import { DynamoCourse } from '../models/course.dynamo.model';

@Injectable()
export class CourseDynamoRepository {
  private readonly logger = new Logger(CourseDynamoRepository.name);
  private readonly tableName: string;
  
  constructor(
    private dynamoDBService: DynamoDBService,
    private configService: ConfigService,
  ) {
    // 获取课程表名
    this.tableName = this.configService.get<string>(
      'DYNAMODB_COURSES_TABLE',
      'web3-university-dev-courses'
    );
  }
  
  // 创建课程
  async create(courseData: Partial<DynamoCourse>): Promise<DynamoCourse> {
    const course = new DynamoCourse({
      ...courseData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    await this.dynamoDBService.putItem(this.tableName, course.toDynamoItem());
    return course;
  }
  
  // 通过ID查找课程
  async findOne(id: string): Promise<DynamoCourse | null> {
    const result = await this.dynamoDBService.getItem(this.tableName, { id });
    return DynamoCourse.fromDynamoItem(result);
  }
  
  // 查找所有课程
  async findAll(limit?: number, lastEvaluatedKey?: Record<string, any>): Promise<{ courses: DynamoCourse[], lastEvaluatedKey?: Record<string, any> }> {
    const result = await this.dynamoDBService.scan(
      this.tableName,
      undefined,
      undefined,
      undefined
    );
    
    const courses = (result.Items || []).map(item => DynamoCourse.fromDynamoItem(item));
    
    return {
      courses: courses.filter(course => course !== null) as DynamoCourse[],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }
  
  // 更新课程
  async update(id: string, courseData: Partial<DynamoCourse>): Promise<DynamoCourse | null> {
    // 检查课程是否存在
    const existingCourse = await this.findOne(id);
    if (!existingCourse) {
      throw new NotFoundException(`课程ID为 ${id} 的记录不存在`);
    }
    
    // 构建更新表达式
    let updateExpression = 'SET';
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};
    
    // 创建一个新对象，包含课程数据和更新时间
    const updatedData = {
      ...courseData,
      updatedAt: new Date().toISOString()
    };
    
    // 动态构建更新表达式
    let isFirst = true;
    Object.keys(updatedData).forEach((key) => {
      if (key !== 'id' && key !== 'createdAt' && updatedData[key] !== undefined) {
        updateExpression += isFirst ? ` #${key} = :${key}` : `, #${key} = :${key}`;
        expressionAttributeValues[`:${key}`] = updatedData[key];
        expressionAttributeNames[`#${key}`] = key;
        isFirst = false;
      }
    });
    
    // 执行更新
    const result = await this.dynamoDBService.updateItem(
      this.tableName,
      { id },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );
    
    return DynamoCourse.fromDynamoItem(result.Attributes);
  }
  
  // 删除课程
  async remove(id: string): Promise<void> {
    // 检查课程是否存在
    const existingCourse = await this.findOne(id);
    if (!existingCourse) {
      throw new NotFoundException(`课程ID为 ${id} 的记录不存在`);
    }
    
    await this.dynamoDBService.deleteItem(this.tableName, { id });
  }
  
  // 通过web2CourseId查找课程
  async findByWeb2CourseId(web2CourseId: string): Promise<DynamoCourse | null> {
    const result = await this.dynamoDBService.query(
      this.tableName,
      'web2CourseId = :web2CourseId',
      { ':web2CourseId': web2CourseId },
      undefined,
      'web2CourseIdIndex'
    );
    
    if (!result.Items || result.Items.length === 0) {
      return null;
    }
    
    return DynamoCourse.fromDynamoItem(result.Items[0]);
  }
}
