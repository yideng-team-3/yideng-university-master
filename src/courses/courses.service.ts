import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourseRepositoryAdapter } from './adapters/course.repository.adapter';
import { Course } from './entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PublishCourseOnchainDto } from './dto/publish-course-onchain.dto';
import { CourseContractService } from '../web3/services/course-contract.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly courseRepository: CourseRepositoryAdapter,
    private readonly courseContractService: CourseContractService,
    private readonly configService: ConfigService, // 添加ConfigService注入
  ) {}

  // 创建新课程
  async create(createCourseDto: CreateCourseDto): Promise<Course> {
    // 验证课程URL和缩略图URL的有效性
    if (!this.isValidUrl(createCourseDto.contentUrl)) {
      throw new BadRequestException('课程内容URL无效');
    }
    
    if (createCourseDto.thumbnailUrl && !this.isValidUrl(createCourseDto.thumbnailUrl)) {
      throw new BadRequestException('缩略图URL无效');
    }
    
    // 生成Web2课程ID
    const web2CourseId = `course_${uuidv4()}`;
    
    // 创建新课程
    const newCourse = await this.courseRepository.create({
      ...createCourseDto,
      web2CourseId,
    });
    
    this.logger.log(`课程创建成功: ${newCourse.id}, web2CourseId: ${web2CourseId}`);
    return newCourse;
  }

  // 获取所有课程
  async findAll(): Promise<Course[]> {
    const courses = await this.courseRepository.findAll();
    this.logger.debug(`获取所有课程，共 ${courses.length} 条记录`);
    return courses;
  }

  // 通过ID查找课程
  async findOne(id: string): Promise<Course> {
    const course = await this.courseRepository.findOne(id);
    if (!course) {
      this.logger.warn(`未找到ID为 ${id} 的课程`);
      throw new NotFoundException(`ID为 ${id} 的课程不存在`);
    }
    return course;
  }

  // 更新课程
  async update(id: string, updateCourseDto: UpdateCourseDto): Promise<Course> {
    // 验证课程是否存在
    const existingCourse = await this.findOne(id);
    
    // 验证URL格式(如果提供)
    if (updateCourseDto.contentUrl && !this.isValidUrl(updateCourseDto.contentUrl)) {
      throw new BadRequestException('课程内容URL无效');
    }
    
    if (updateCourseDto.thumbnailUrl && !this.isValidUrl(updateCourseDto.thumbnailUrl)) {
      throw new BadRequestException('缩略图URL无效');
    }
    
    // 确保创建者地址不能被更改
    if (updateCourseDto.creatorAddress && 
        updateCourseDto.creatorAddress !== existingCourse.creatorAddress) {
      throw new BadRequestException('课程创建者地址不能被修改');
    }
    
    const updatedCourse = await this.courseRepository.update(id, updateCourseDto);
    if (!updatedCourse) {
      throw new NotFoundException(`ID为 ${id} 的课程不存在`);
    }
    
    this.logger.log(`课程更新成功: ${id}`);
    return updatedCourse;
  }

  // 删除课程
  async remove(id: string): Promise<void> {
    // 检查课程是否存在
    await this.findOne(id);
    
    // 检查课程是否已上链 (可以通过调用合约方法检查)
    try {
      const isOnChain = await this.courseContractService.checkCourseExists(id);
      if (isOnChain) {
        throw new ConflictException('已上链的课程不能删除');
      }
    } catch (error) {
      // 如果无法连接到区块链，则记录警告但允许删除
      this.logger.warn(`无法验证课程 ${id} 是否已上链: ${error.message}`);
    }
    
    // 删除课程
    await this.courseRepository.remove(id);
    this.logger.log(`课程删除成功: ${id}`);
  }

  // 将课程发布到区块链
  async publishCourseOnChain(publishDto: PublishCourseOnchainDto): Promise<boolean> {
    const { courseId, price } = publishDto;
    
    // 检查课程是否存在
    const course = await this.findOne(courseId);
    
    // 检查价格是否合理
    if (price <= 0) {
      throw new BadRequestException('课程价格必须大于0');
    }
    
    // 检查课程是否已经上链
    try {
      const isAlreadyOnChain = await this.courseContractService.checkCourseExists(course.web2CourseId);
      if (isAlreadyOnChain) {
        this.logger.warn(`课程已经上链: ${courseId}, Web2ID: ${course.web2CourseId}`);
        throw new ConflictException('课程已经上链');
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      // 其他错误继续处理
      this.logger.warn(`无法验证课程是否已上链: ${error.message}`);
    }
    
    try {
      // 将课程添加到区块链
      await this.courseContractService.addCourse(
        course.web2CourseId,
        course.title,
        price,
        course.creatorAddress
      );
      
      this.logger.log(`课程成功上链: ${courseId}, Web2ID: ${course.web2CourseId}`);
      return true;
    } catch (error) {
      this.logger.error(`课程上链失败: ${error.message}`, error.stack);
      throw new BadRequestException(`课程上链失败: ${error.message}`);
    }
  }

  // 通过Web2课程ID查找课程
  async findByWeb2CourseId(web2CourseId: string): Promise<Course> {
    const course = await this.courseRepository.findByWeb2CourseId(web2CourseId);
    if (!course) {
      this.logger.warn(`未找到Web2课程ID为 ${web2CourseId} 的课程`);
      throw new NotFoundException(`Web2课程ID为 ${web2CourseId} 的课程不存在`);
    }
    return course;
  }

  // 验证URL格式
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      
      // 检查URL是否是S3链接(可选，但有助于确保资源在正确的位置)
      const bucketName = this.configService.get<string>('S3_BUCKET_NAME'); // 使用本地的configService
      if (bucketName && !url.includes(bucketName)) {
        this.logger.warn(`URL不是来自应用的S3桶: ${url}`);
        return false;
      }
      
      return true;
    } catch (err) {
      return false;
    }
  }
}
