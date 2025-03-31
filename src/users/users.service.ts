import { Injectable } from '@nestjs/common';
import { User } from './entities/users.entity';
import { UserRepositoryAdapter } from './adapters/user.repository.adapter';

@Injectable()
export class UsersService {
  constructor(private userRepository: UserRepositoryAdapter) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne(id);
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.userRepository.findByWalletAddress(walletAddress);
  }

  async create(userData: Partial<User>): Promise<User> {
    return this.userRepository.create(userData);
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    return this.userRepository.update(id, userData);
  }

  async save(user: Partial<User>): Promise<User | null> {
    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    return this.userRepository.remove(id);
  }
}
