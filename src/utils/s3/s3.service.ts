import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as stream from 'stream';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly baseUrl: string;
  private readonly isLocalStack: boolean;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-2');
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME', 'web3-university-dev');
    this.isLocalStack = process.env.IS_OFFLINE === 'true' || process.env.USE_LOCALSTACK === 'true';
    
    // 创建S3客户端
    const clientOptions: any = {
      region: this.region,
      credentials: this.isLocalStack
        ? { accessKeyId: 'local', secretAccessKey: 'local' }
        : undefined
    };
    
    // 如果使用LocalStack，添加endpoint配置
    if (this.isLocalStack) {
      clientOptions.endpoint = 'http://localhost:4566';
      clientOptions.forcePathStyle = true; // 必须设置为true才能在本地正确工作
      this.logger.log('使用LocalStack进行本地S3测试');
    }
    
    this.s3Client = new S3Client(clientOptions);
    
    // 设置基础URL
    this.baseUrl = this.isLocalStack 
      ? `http://localhost:4566/${this.bucketName}`
      : `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;
    
    this.logger.log(`S3服务初始化完成, 存储桶: ${this.bucketName}, 区域: ${this.region}, 本地测试: ${this.isLocalStack}`);
  }

  // 获取上传预签名URL
  async getPresignedUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType
    });
    
    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      this.logger.log(`生成预签名URL: ${key}`);
      return signedUrl;
    } catch (error) {
      this.logger.error(`生成预签名URL失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // 获取文件的公开URL
  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  // 获取下载预签名URL
  async getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });
    
    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      this.logger.error(`生成下载URL失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // 删除文件
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });
    
    try {
      await this.s3Client.send(command);
      this.logger.log(`文件删除成功: ${key}`);
    } catch (error) {
      this.logger.error(`文件删除失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // 直接上传文件内容到S3
  async uploadFile(
    fileBuffer: Buffer, 
    originalFilename: string,
    folderName: string = 'uploads'
  ): Promise<{ fileUrl: string; key: string }> {
    // 生成唯一的文件名
    const extension = path.extname(originalFilename);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const key = `${folderName}/${timestamp}-${randomString}${extension}`;
    
    // 获取内容类型
    const contentType = this.getContentType(extension.replace('.', ''));
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });
      
      await this.s3Client.send(command);
      this.logger.log(`文件上传成功: ${key}`);
      
      const fileUrl = this.getPublicUrl(key);
      return { fileUrl, key };
    } catch (error) {
      this.logger.error(`文件上传失败: ${error.message}`, error.stack);
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }
  
  // 上传视频文件到S3
  async uploadVideo(
    videoPath: string,
    destinationKey?: string
  ): Promise<{ fileUrl: string; key: string }> {
    try {
      // 如果没有提供目标键，则从文件路径生成
      if (!destinationKey) {
        const filename = path.basename(videoPath);
        const timestamp = Date.now();
        destinationKey = `courses/${timestamp}-${filename}`;
      }
      
      // 读取文件
      const fileContent = await fs.promises.readFile(videoPath);
      
      // 确定内容类型
      const extension = path.extname(videoPath).replace('.', '').toLowerCase();
      const contentType = this.getContentType(extension);
      
      // 上传到S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: destinationKey,
        Body: fileContent,
        ContentType: contentType,
      });
      
      await this.s3Client.send(command);
      this.logger.log(`视频上传成功: ${destinationKey}`);
      
      // 返回文件URL和键
      const fileUrl = this.getPublicUrl(destinationKey);
      return { fileUrl, key: destinationKey };
    } catch (error) {
      this.logger.error(`视频上传失败: ${error.message}`, error.stack);
      throw new Error(`视频上传失败: ${error.message}`);
    }
  }
  
  // 分片上传大型文件到S3（适用于大型视频）
  async uploadLargeFile(
    filePath: string,
    destinationKey?: string
  ): Promise<{ fileUrl: string; key: string }> {
    try {
      // 如果没有提供目标键，则从文件路径生成
      if (!destinationKey) {
        const filename = path.basename(filePath);
        const timestamp = Date.now();
        destinationKey = `courses/${timestamp}-${filename}`;
      }
      
      // 创建可读流
      const fileStream = fs.createReadStream(filePath);
      
      // 确定内容类型
      const extension = path.extname(filePath).replace('.', '').toLowerCase();
      const contentType = this.getContentType(extension);
      
      // 上传到S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: destinationKey,
        Body: fileStream,
        ContentType: contentType,
      });
      
      await this.s3Client.send(command);
      this.logger.log(`大型文件上传成功: ${destinationKey}`);
      
      // 返回文件URL和键
      const fileUrl = this.getPublicUrl(destinationKey);
      return { fileUrl, key: destinationKey };
    } catch (error) {
      this.logger.error(`大型文件上传失败: ${error.message}`, error.stack);
      throw new Error(`大型文件上传失败: ${error.message}`);
    }
  }
  
  // 从流上传文件
  async uploadFromStream(
    fileStream: stream.Readable,
    filename: string,
    folderName: string = 'uploads'
  ): Promise<{ fileUrl: string; key: string }> {
    try {
      // 生成唯一的文件名
      const extension = path.extname(filename);
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const key = `${folderName}/${timestamp}-${randomString}${extension}`;
      
      // 确定内容类型
      const contentType = this.getContentType(extension.replace('.', ''));
      
      // 将流转换为Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(chunks);
      
      // 上传到S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });
      
      await this.s3Client.send(command);
      this.logger.log(`从流上传文件成功: ${key}`);
      
      // 返回文件URL和键
      const fileUrl = this.getPublicUrl(key);
      return { fileUrl, key };
    } catch (error) {
      this.logger.error(`从流上传文件失败: ${error.message}`, error.stack);
      throw new Error(`从流上传文件失败: ${error.message}`);
    }
  }
  
  // 获取MIME类型
  getContentType(fileExtension: string): string {
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
      'avi': 'video/x-msvideo',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'mkv': 'video/x-matroska'
    };
    
    const audioTypes = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'aac': 'audio/aac'
    };
    
    const documentTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain'
    };
    
    if (imageTypes[fileExtension.toLowerCase()]) {
      return imageTypes[fileExtension.toLowerCase()];
    }
    
    if (videoTypes[fileExtension.toLowerCase()]) {
      return videoTypes[fileExtension.toLowerCase()];
    }
    
    if (audioTypes[fileExtension.toLowerCase()]) {
      return audioTypes[fileExtension.toLowerCase()];
    }
    
    if (documentTypes[fileExtension.toLowerCase()]) {
      return documentTypes[fileExtension.toLowerCase()];
    }
    
    return 'application/octet-stream';
  }
}
