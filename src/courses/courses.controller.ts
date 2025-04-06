import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  UseGuards, 
  Patch,
  BadRequestException,
  ParseUUIDPipe,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseFilePipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PublishCourseOnchainDto } from './dto/publish-course-onchain.dto';
import { Public } from '../auth/decorators/public.decorator';
import { S3Service } from '../utils/s3/s3.service';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly s3Service: S3Service
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建新课程' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数验证失败' })
  async create(
    @Body(new ValidationPipe({ 
      whitelist: true, 
      forbidNonWhitelisted: true,
      transform: true
    })) createCourseDto: CreateCourseDto
  ) {
    return this.coursesService.create(createCourseDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: '获取所有课程' })
  async findAll() {
    return this.coursesService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '获取课程详情' })
  @ApiParam({ name: 'id', description: '课程ID', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: '成功获取课程信息' })
  @ApiResponse({ status: 404, description: '课程不存在' })
  async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.coursesService.findOne(id);
  }

  @Get('web2/:web2CourseId')
  @Public()
  @ApiOperation({ summary: '通过Web2课程ID获取课程' })
  @ApiParam({ name: 'web2CourseId', description: 'Web2课程ID', type: 'string' })
  @ApiResponse({ status: 200, description: '成功获取课程信息' })
  @ApiResponse({ status: 404, description: '课程不存在' })
  async findByWeb2Id(
    @Param('web2CourseId') web2CourseId: string
  ) {
    if (!web2CourseId || web2CourseId.trim() === '') {
      throw new BadRequestException('Web2课程ID不能为空');
    }
    
    return this.coursesService.findByWeb2CourseId(web2CourseId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新课程信息' })
  @ApiParam({ name: 'id', description: '课程ID', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: '课程更新成功' })
  @ApiResponse({ status: 400, description: '请求参数验证失败' })
  @ApiResponse({ status: 404, description: '课程不存在' })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe({ 
      whitelist: true, 
      forbidNonWhitelisted: true,
      transform: true
    })) updateCourseDto: UpdateCourseDto
  ) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除课程' })
  @ApiParam({ name: 'id', description: '课程ID', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: '课程删除成功' })
  @ApiResponse({ status: 404, description: '课程不存在' })
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    await this.coursesService.remove(id);
    return { success: true, message: '课程删除成功' };
  }

  @Post('publish-onchain')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '将课程发布到区块链' })
  @ApiResponse({ status: 200, description: '发布成功' })
  @ApiResponse({ status: 400, description: '发布失败或参数错误' })
  @ApiResponse({ status: 404, description: '课程不存在' })
  async publishOnChain(
    @Body(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })) publishDto: PublishCourseOnchainDto
  ) {
    const success = await this.coursesService.publishCourseOnChain(publishDto);
    return { success, message: success ? '课程成功发布到区块链' : '课程发布失败' };
  }

  @Post('upload/presigned-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取课程内容上传预签名URL' })
  @ApiResponse({ status: 200, description: '成功获取预签名URL' })
  @ApiResponse({ status: 400, description: '参数错误' })
  async getPresignedUrl(
    @Body(new ValidationPipe({
      whitelist: true,
      transform: true
    })) body: { fileType: string; isVideo?: boolean }
  ) {
    const { fileType, isVideo = false } = body;
    
    if (!fileType) {
      throw new BadRequestException('文件类型不能为空');
    }
    
    // 验证文件类型是否在允许列表中
    const allowedImageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const allowedVideoTypes = ['mp4', 'webm', 'mov', 'avi'];
    const allowedTypes = isVideo ? allowedVideoTypes : allowedImageTypes;
    
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      throw new BadRequestException(`不支持的文件类型。允许的类型: ${allowedTypes.join(', ')}`);
    }
    
    const folder = isVideo ? 'courses' : 'thumbnails';
    const contentType = this.getContentType(fileType);
    const key = `${folder}/${Date.now()}-${Math.floor(Math.random() * 10000)}.${fileType}`;
    
    const presignedUrl = await this.s3Service.getPresignedUrl(key, contentType);
    
    return {
      presignedUrl,
      fileUrl: this.s3Service.getPublicUrl(key)
    };
  }

  @Post('upload/video')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '直接上传视频文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '视频上传成功' })
  @ApiResponse({ status: 400, description: '上传失败' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'uploads');
          // 确保上传目录存在
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          // 生成唯一文件名
          const uniqueSuffix = Date.now() + '-' + uuidv4();
          const extension = path.extname(file.originalname);
          cb(null, `${uniqueSuffix}${extension}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // 检查文件MIME类型
        const validMimeTypes = [
          'video/mp4',
          'video/webm',
          'video/quicktime',
          'video/x-msvideo',
          'video/x-ms-wmv',
        ];
        
        if (!validMimeTypes.includes(file.mimetype)) {
          return cb(new BadRequestException('只允许上传视频文件 (MP4, WebM, MOV, AVI, WMV)'), false);
        }
        
        cb(null, true);
      },
      limits: {
        fileSize: 1024 * 1024 * 500, // 500MB文件大小限制
      },
    }),
  )
  async uploadVideo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 500 }), // 500MB
          new FileTypeValidator({ fileType: '.(mp4|webm|mov|avi|wmv)' }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('没有上传文件');
      }
      
      // 上传到S3
      const result = await this.s3Service.uploadVideo(file.path);
      
      // 删除临时文件
      await fs.promises.unlink(file.path);
      
      return {
        success: true,
        fileUrl: result.fileUrl,
        key: result.key,
        message: '视频上传成功'
      };
    } catch (error) {
      throw new BadRequestException(`视频上传失败: ${error.message}`);
    }
  }

  @Post('upload/thumbnail')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '直接上传缩略图文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '缩略图上传成功' })
  @ApiResponse({ status: 400, description: '上传失败' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + uuidv4();
          const extension = path.extname(file.originalname);
          cb(null, `${uniqueSuffix}${extension}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const validMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ];
        
        if (!validMimeTypes.includes(file.mimetype)) {
          return cb(new BadRequestException('只允许上传图片文件 (JPG, JPEG, PNG, GIF, WEBP)'), false);
        }
        
        cb(null, true);
      },
      limits: {
        fileSize: 1024 * 1024 * 5, // 5MB
      },
    }),
  )
  async uploadThumbnail(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
          new FileTypeValidator({ fileType: '.(jpg|jpeg|png|gif|webp)' }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('没有上传文件');
      }
      
      // 上传到S3，使用thumbnails文件夹
      const result = await this.s3Service.uploadFile(
        await fs.promises.readFile(file.path),
        file.originalname,
        'thumbnails'
      );
      
      // 删除临时文件
      await fs.promises.unlink(file.path);
      
      return {
        success: true,
        fileUrl: result.fileUrl,
        key: result.key,
        message: '缩略图上传成功'
      };
    } catch (error) {
      throw new BadRequestException(`缩略图上传失败: ${error.message}`);
    }
  }

  private getContentType(fileType: string): string {
    const imageTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    
    const videoTypes = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo'
    };
    
    if (imageTypes[fileType.toLowerCase()]) {
      return imageTypes[fileType.toLowerCase()];
    }
    
    if (videoTypes[fileType.toLowerCase()]) {
      return videoTypes[fileType.toLowerCase()];
    }
    
    return 'application/octet-stream';
  }
}
