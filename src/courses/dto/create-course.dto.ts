import { IsString, IsOptional, IsUrl, MinLength, MaxLength, Matches, IsEthereumAddress } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ description: '课程标题', example: 'Web3入门课程' })
  @IsString({ message: '课程标题必须是字符串' })
  @MinLength(2, { message: '课程标题不能少于2个字符' })
  @MaxLength(100, { message: '课程标题不能超过100个字符' })
  title: string;

  @ApiProperty({ description: '课程描述', example: '这是一门Web3入门课程，介绍区块链基础知识' })
  @IsOptional()
  @IsString({ message: '课程描述必须是字符串' })
  @MaxLength(2000, { message: '课程描述不能超过2000个字符' })
  description?: string;

  @ApiProperty({ description: '课程内容URL（S3地址）', example: 'https://bucket-name.s3.region.amazonaws.com/courses/video.mp4' })
  @IsUrl({}, { message: '内容URL格式不正确' })
  @Matches(/\.(mp4|webm|mov|avi)$/i, { message: '内容URL必须是视频文件链接(.mp4, .webm, .mov, .avi)' })
  contentUrl: string;

  @ApiProperty({ description: '课程缩略图URL', required: false, example: 'https://bucket-name.s3.region.amazonaws.com/thumbnails/image.jpg' })
  @IsOptional()
  @IsUrl({}, { message: '缩略图URL格式不正确' })
  @Matches(/\.(jpg|jpeg|png|gif|webp)$/i, { message: '缩略图URL必须是图片文件链接(.jpg, .jpeg, .png, .gif, .webp)' })
  thumbnailUrl?: string;

  @ApiProperty({ description: '创建者钱包地址', required: true, example: '0x1234...' })
  @IsEthereumAddress({ message: '创建者钱包地址必须是有效的以太坊地址' })
  creatorAddress: string;
}
