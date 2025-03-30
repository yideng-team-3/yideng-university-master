import { Body, Controller, Post, Req, UnauthorizedException, UseGuards, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  async getNonce(@Body() body: { walletAddress: string }) {
    const { walletAddress } = body;
    
    if (!walletAddress) {
      throw new UnauthorizedException('缺少钱包地址');
    }
    
    const nonce = await this.authService.generateNonce(walletAddress);
    const signMessage = this.authService.createSignMessage(walletAddress, nonce);
    
    return {
      success: true,
      nonce,
      signMessage,
    };
  }

  @Post('web3-login')
  async web3Login(
    @Body() body: { 
      walletAddress: string; 
      signature: string;
      nonce: string;
      avatarUrl?: string;
      ensName?: string;
    }, 
    @Req() req: Request
  ) {
    const { walletAddress, signature, nonce, avatarUrl, ensName } = body;
    
    if (!walletAddress || !signature || !nonce) {
      throw new UnauthorizedException('缺少必要参数');
    }
    
    return this.authService.web3Login(
      walletAddress, 
      signature,
      nonce,
      req,
      avatarUrl,
      ensName
    );
  }

  @Get('check-login-status')
  async checkLoginStatus(@Query('walletAddress') walletAddress: string) {
    if (!walletAddress) {
      throw new UnauthorizedException('缺少钱包地址');
    }
    
    return this.authService.checkLoginStatus(walletAddress);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout() {
    return { message: 'Logged out successfully' };
  }
}
