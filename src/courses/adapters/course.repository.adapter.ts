import { Injectable } from '@nestjs/common';
import { Course } from '../entities/course.entity';
import { CourseDynamoRepository } from '../repositories/course.dynamo.repository';
import { DynamoCourse } from '../models/course.dynamo.model';

@Injectable()
export class CourseRepositoryAdapter {
  constructor(
    private courseDynamoRepository: CourseDynamoRepository,
  ) {}

  // 创建新课程
  async create(courseData: Partial<Course>): Promise<Course> {
    const dynamoCourse = await this.courseDynamoRepository.create(this.convertToDynamoCourse(courseData));
    return this.convertToCourse(dynamoCourse);
  }

  // 通过ID查找课程
  async findOne(id: string): Promise<Course | null> {
    const dynamoCourse = await this.courseDynamoRepository.findOne(id);
    return dynamoCourse ? this.convertToCourse(dynamoCourse) : null;
  }

  // 查找所有课程
  async findAll(): Promise<Course[]> {
    const { courses } = await this.courseDynamoRepository.findAll();
    return courses.map(course => this.convertToCourse(course));
  }

  // 更新课程
  async update(id: string, courseData: Partial<Course>): Promise<Course | null> {
    const dynamoCourse = await this.courseDynamoRepository.update(id, this.convertToDynamoCourse(courseData));
    return this.convertToCourse(dynamoCourse as DynamoCourse);
  }

  // 删除课程
  async remove(id: string): Promise<void> {
    await this.courseDynamoRepository.remove(id);
  }

  // 通过web2CourseId查找课程
  async findByWeb2CourseId(web2CourseId: string): Promise<Course | null> {
    const dynamoCourse = await this.courseDynamoRepository.findByWeb2CourseId(web2CourseId);
    return dynamoCourse ? this.convertToCourse(dynamoCourse) : null;
  }

  // 将 Course 转换为 DynamoCourse
  private convertToDynamoCourse(course: Partial<Course>): Partial<DynamoCourse> {
    // 提取非日期字段
    const { createdAt, updatedAt, ...rest } = course;
    
    // 基础字段转换
    const dynamoCourse: Partial<DynamoCourse> = { ...rest };
    
    // 处理日期转换
    if (createdAt instanceof Date) {
      dynamoCourse.createdAt = createdAt.toISOString();
    }
    if (updatedAt instanceof Date) {
      dynamoCourse.updatedAt = updatedAt.toISOString();
    }
    
    return dynamoCourse;
  }

  // 将 DynamoCourse 转换为 Course
  private convertToCourse(dynamoCourse: DynamoCourse): Course {
    const course = new Course();
    
    // 复制属性
    Object.keys(dynamoCourse).forEach(key => {
      if (key !== 'createdAt' && key !== 'updatedAt') {
        course[key] = dynamoCourse[key];
      }
    });
    
    // 处理日期转换
    if (dynamoCourse.createdAt) {
      course.createdAt = new Date(dynamoCourse.createdAt);
    }
    if (dynamoCourse.updatedAt) {
      course.updatedAt = new Date(dynamoCourse.updatedAt);
    }
    
    return course;
  }
}
