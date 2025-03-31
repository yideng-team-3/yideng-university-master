import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/users.entity';
import { Request } from 'express';
import { Web3Service } from '../web3/web3.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private web3Service: Web3Service,
  ) {}

  /**
   * 生成随机 nonce 并关联到用户
   * @param walletAddress 钱包地址
   * @returns 生成的 nonce
   */
  async generateNonce(walletAddress: string): Promise<string> {
    const nonce = this.web3Service ? this.web3Service.generateNonce() : crypto.randomUUID();
    
    // 查找或创建用户
    let user = await this.usersService.findByWalletAddress(walletAddress);
    
    if (!user) {
      // 如果用户不存在，创建一个新用户，只保存钱包地址和nonce
      const shortAddress = walletAddress.substring(0, 6);
      const username = `wallet_${shortAddress}_${Date.now()}`;
      
      user = await this.usersService.create({
        walletAddress,
        username,
        nonce,
      } as Partial<User>);
    } else {
      // 如果用户存在，更新 nonce
      user.nonce = nonce;
      await this.usersService.save(user);
    }
    
    return nonce;
  }

  /**
   * 验证签名
   * @param message 要验证的消息
   * @param signature 签名
   * @param address 钱包地址
   * @returns 签名是否有效
   */
  async validateSignature(message: string, signature: string, address: string): Promise<boolean> {
    // 验证签名
    if (this.web3Service) {
      return this.web3Service.verifySignature(message, signature, address);
    }
    
    throw new Error('Web3Service 不可用，无法验证签名');
  }

  /**
   * 创建签名消息
   * @param walletAddress 钱包地址
   * @param nonce 随机数
   * @returns 签名消息
   */
  createSignMessage(walletAddress: string, nonce: string): string {
    if (this.web3Service) {
      return this.web3Service.createSignMessage(walletAddress, nonce);
    }
    
    // 如果没有 web3Service，提供一个默认实现
    return `欢迎访问 Web3 University!

点击签名以登录并接受我们的服务条款和隐私政策。

此请求不会触发区块链交易或消耗任何 gas 费用。

钱包地址:
${walletAddress}

Nonce:
${nonce}`;
  }

  /**
   * Web3 钱包一键登录 - 无状态实现
   * @param walletAddress 钱包地址
   * @param signature 签名
   * @param nonce 用于生成签名的nonce
   * @param req 请求对象
   * @param avatarUrl 可选的头像URL
   * @param ensName 可选的ENS名称
   * @returns 登录信息
   */
  async web3Login(
    walletAddress: string,
    signature: string,
    nonce: string,
    req: Request,
    avatarUrl?: string,
    ensName?: string,
  ): Promise<any> {
    // 创建消息
    const message = this.createSignMessage(walletAddress, nonce);
    
    // 验证签名合法性
    const isValid = await this.validateSignature(message, signature, walletAddress);
    
    if (!isValid) {
      throw new UnauthorizedException('签名验证失败');
    }

    // 查找或创建用户
    let user = await this.usersService.findByWalletAddress(walletAddress);
    
    if (!user) {
      // 如果用户不存在，创建新用户
      const shortAddress = walletAddress.substring(0, 6);
      const username = `wallet_${shortAddress}_${Date.now()}`;
      
      user = await this.usersService.create({
        walletAddress,
        username,
        nonce: this.web3Service ? this.web3Service.generateNonce() : crypto.randomUUID(),
        avatarUrl,
        ensName,
      } as Partial<User>);
    } else {
      // 更新用户信息
      user.nonce = this.web3Service ? this.web3Service.generateNonce() : crypto.randomUUID();
      if (avatarUrl) user.avatarUrl = avatarUrl;
      if (ensName) user.ensName = ensName;
      user.lastLoginAt = new Date();
      await this.usersService.save(user);
    }

    // 生成JWT
    const payload = { 
      sub: user.id, 
      walletAddress: user.walletAddress,
      username: user.username
    };
    
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        avatarUrl: user.avatarUrl,
        ensName: user.ensName,
      },
    };
  }

  /**
   * 验证JWT令牌并返回用户信息
   * @param token JWT令牌
   * @returns 用户信息
   */
  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findOne(payload.sub);
      
      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }
      
      return user;
    } catch (error) {
      throw new UnauthorizedException('无效的令牌');
    }
  }

  /**
   * 检查用户是否已登录 - 根据JWT验证
   * @param token JWT令牌
   * @returns 用户登录状态信息
   */
  async checkLoginStatus(token: string): Promise<{isLoggedIn: boolean; user?: any; message: string}> {
    try {
      if (!token) {
        return { 
          isLoggedIn: false, 
          message: '未提供令牌' 
        };
      }
      
      // 验证令牌
      const user = await this.validateToken(token);
      
      if (!user) {
        return { 
          isLoggedIn: false, 
          message: '无效的令牌或用户不存在' 
        };
      }
      
      // 令牌有效，返回用户信息
      return {
        isLoggedIn: true,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          avatarUrl: user.avatarUrl,
          ensName: user.ensName,
        },
        message: '用户已登录'
      };
    } catch (error) {
      console.error('检查登录状态时出错:', error);
      return {
        isLoggedIn: false,
        message: '验证登录状态时发生错误'
      };
    }
  }
}
