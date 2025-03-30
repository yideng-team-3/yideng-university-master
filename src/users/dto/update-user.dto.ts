import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  username?: string;

  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}
