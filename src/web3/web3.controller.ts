import { Body, Controller, Post, Get, UnauthorizedException } from '@nestjs/common';
import { Web3Service } from './web3.service';
import { UsersService } from '../users/users.service';
import { Web3SignatureVerifyDto } from './dto/web3-auth.dto';

@Controller('web3')
export class Web3Controller {
  constructor(
    private readonly web3Service: Web3Service,
    private readonly usersService: UsersService,
  ) {}

  @Post('verify-signature')
  async verifySignature(@Body() verifyDto: Web3SignatureVerifyDto) {
    const { signature, address, nonce, avatarUrl, ensName } = verifyDto;
    
    if (!signature || !address || !nonce) {
      throw new UnauthorizedException('缺少必要参数');
    }

    // 创建原始消息
    const message = this.web3Service.createSignMessage(address, nonce);
    
    // 验证签名
    const isValid = await this.web3Service.verifySignature(message, signature, address);
    
    if (!isValid) {
      throw new UnauthorizedException('签名验证失败');
    }

    // 查找或创建与钱包地址关联的用户
    const user = await this.usersService.findOrCreateByWalletAddress(
      address,
      avatarUrl, 
      ensName
    );

    return {
      success: true,
      message: '签名验证成功',
      address,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        avatarUrl: user.avatarUrl,
        ensName: user.ensName,
      }
    };
  }

  @Post('link-wallet')
  async linkWalletToUser(
    @Body() body: { 
      userId: number;
      signature: string; 
      address: string; 
      nonce: string;
      avatarUrl?: string;
      ensName?: string;
    },
  ) {
    const { userId, signature, address, nonce, avatarUrl, ensName } = body;
    
    // 验证签名
    const message = this.web3Service.createSignMessage(address, nonce);
    const isValid = await this.web3Service.verifySignature(message, signature, address);
    
    if (!isValid) {
      throw new UnauthorizedException('签名验证失败');
    }

    // 将钱包地址关联到指定用户
    const user = await this.usersService.linkWalletToUser(userId, address, avatarUrl, ensName);

    return {
      success: true,
      message: '钱包地址已成功关联到用户',
      user: {
        id: user.id,
        username: user.username,
        walletAddress: user.walletAddress,
        avatarUrl: user.avatarUrl,
        ensName: user.ensName,
      }
    };
  }
}
