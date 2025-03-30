import { IsEthereumAddress, IsNotEmpty, IsString } from "class-validator";

export class WalletAuthDto {
  @IsEthereumAddress()
  @IsNotEmpty()
  walletAddress: string;
}

export class VerifySignatureDto {
  @IsEthereumAddress()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}
