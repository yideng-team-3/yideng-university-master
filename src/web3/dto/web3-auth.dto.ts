import { IsString, IsNotEmpty, IsOptional, IsEthereumAddress } from 'class-validator';

export class Web3SignatureVerifyDto {
  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsEthereumAddress()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  nonce: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  ensName?: string;
}
