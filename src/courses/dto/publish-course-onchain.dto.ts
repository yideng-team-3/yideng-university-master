import { IsString, IsNumber, Min, Max, Matches, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PublishCourseOnchainDto {
  @ApiProperty({ description: '课程ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID(4, { message: '课程ID必须是有效的UUID格式' })
  courseId: string;

  @ApiProperty({ description: '课程价格(YD代币)', example: 100 })
  @Type(() => Number)
  @IsNumber({}, { message: '价格必须是数字' })
  @Min(0, { message: '价格不能小于0' })
  @Max(1000000, { message: '价格不能超过1,000,000代币' })
  price: number;
}
