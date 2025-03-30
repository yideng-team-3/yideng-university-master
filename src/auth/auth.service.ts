import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/users.entity';
import { UserSession } from '../users/entities/user-session.entity';
import { Request } from 'express';
import { Web3Service } from '../web3/web3.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(UserSession)
    private userSessionsRepository: Repository<UserSession>,
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
   * 验证签名（带过期检查）
   * @param message 要验证的消息
   * @param signature 签名
   * @param address 钱包地址
   * @returns 签名是否有效
   */
  async validateSignature(message: string, signature: string, address: string): Promise<boolean> {
    // 首先检查签名会话是否存在且未过期
    const session = await this.userSessionsRepository.findOne({
      where: { signature }
    });

    if (session) {
      // 如果找到会话，检查是否已过期
      if (new Date() > session.expiresAt) {
        console.error('签名已过期');
        return false;
      }
    }

    // 验证签名本身
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
   * 处理用户会话创建
   * @param user 用户对象
   * @param signature 签名
   * @param req 请求对象
   * @param expiresInSeconds 会话过期时间（秒）
   * @returns 登录响应对象
   */
  private async createUserSession(
    user: User,
    signature: string,
    req: Request,
    expiresInSeconds: number = 604800 // 默认7天 (7*24*60*60)
  ): Promise<any> {
    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + expiresInSeconds * 1000);
    
    // 创建会话记录
    const session = this.userSessionsRepository.create({
      userId: String(user.id),
      signature,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    await this.userSessionsRepository.save(session);
    
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
   * Web3 钱包一键登录
   * @param walletAddress 钱包地址
   * @param signature 签名
   * @param nonce 用于生成签名的nonce
   * @param req 请求对象
   * @param avatarUrl 可选的头像URL
   * @param ensName 可选的ENS名称
   * @param expiresInSeconds 签名过期时间（秒）
   * @returns 登录信息
   */
  async web3Login(
    walletAddress: string,
    signature: string,
    nonce: string,
    req: Request,
    avatarUrl?: string,
    ensName?: string,
    expiresInSeconds: number = 604800 // 默认7天
  ): Promise<any> {
    // 创建消息
    const message = this.createSignMessage(walletAddress, nonce);
    
    // 验证签名合法性
    const isValid = await this.web3Service.verifySignature(message, signature, walletAddress);
    
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

    // 创建会话并返回登录信息
    return this.createUserSession(user, signature, req, expiresInSeconds);
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
   * 清理过期的用户会话
   * @returns 清理的会话数量
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const result = await this.userSessionsRepository
      .createQueryBuilder()
      .delete()
      .where("expiresAt < :now", { now })
      .execute();
    
    return result.affected || 0;
  }

  /**
   * 检查用户是否已登录
   * @param walletAddress 钱包地址
   * @returns 用户登录状态信息
   */
  async checkLoginStatus(walletAddress: string): Promise<{isLoggedIn: boolean; user?: any; accessToken?: string; message: string}> {
    try {
      // 查找拥有此钱包地址的用户
      const user = await this.usersService.findByWalletAddress(walletAddress);
      
      if (!user) {
        return { 
          isLoggedIn: false, 
          message: '未找到该钱包地址关联的用户' 
        };
      }
      
      // 查找该用户的最新会话
      const session = await this.userSessionsRepository.findOne({
        where: { userId: String(user.id) },
        order: { createdAt: 'DESC' }
      });
      
      if (!session) {
        return { 
          isLoggedIn: false, 
          message: '未找到有效的登录会话' 
        };
      }
      
      // 检查会话是否过期
      if (new Date() > session.expiresAt) {
        return { 
          isLoggedIn: false, 
          message: '登录会话已过期，请重新登录' 
        };
      }
      
      // 生成新的JWT令牌
      const payload = { 
        sub: user.id, 
        walletAddress: user.walletAddress,
        username: user.username
      };
      const accessToken = this.jwtService.sign(payload);
      
      // 会话有效，返回用户信息和访问令牌
      return {
        isLoggedIn: true,
        accessToken,
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
