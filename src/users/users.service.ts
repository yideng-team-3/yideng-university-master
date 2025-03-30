import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/users.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * 通过钱包地址查找用户
   */
  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { walletAddress } });
  }

  /**
   * 通过ID查找用户
   */
  async findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * 根据钱包地址查找或创建用户
   */
  async findOrCreateByWalletAddress(
    walletAddress: string, 
    avatarUrl?: string, 
    ensName?: string
  ): Promise<User> {
    // 查找是否已存在该钱包地址的用户
    let user = await this.findByWalletAddress(walletAddress);
    
    // 如果不存在，创建新用户
    if (!user) {
      // 生成基于钱包地址的用户名
      const shortAddress = walletAddress.substring(0, 6);
      const username = `wallet_${shortAddress}_${Date.now()}`;
      
      user = this.usersRepository.create({
        walletAddress,
        username, // 可选用户名，用于显示
        avatarUrl,
        ensName,
      });
      
      await this.usersRepository.save(user);
    } else if (avatarUrl || ensName) {
      // 如果用户存在但提供了新的头像或ENS，更新这些信息
      if (avatarUrl) user.avatarUrl = avatarUrl;
      if (ensName) user.ensName = ensName;
      await this.usersRepository.save(user);
    }
    
    return user;
  }

  /**
   * 将钱包地址关联到现有用户
   */
  async linkWalletToUser(
    userId: number, 
    walletAddress: string, 
    avatarUrl?: string, 
    ensName?: string
  ): Promise<User> {
    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException(`ID为${userId}的用户不存在`);
    }
    
    user.walletAddress = walletAddress;
    if (avatarUrl) user.avatarUrl = avatarUrl;
    if (ensName) user.ensName = ensName;
    
    return this.usersRepository.save(user);
  }

  /**
   * 创建新用户
   */
  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  /**
   * 保存用户数据
   */
  async save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  async update(id: number, updateUserDto: Partial<User>) {
    return await this.usersRepository.update(id, updateUserDto);
  }
}
