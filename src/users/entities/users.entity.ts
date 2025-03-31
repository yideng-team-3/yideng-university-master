import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  // 钱包地址作为用户的主要标识
  @Column({ length: 42, nullable: false, unique: true })
  walletAddress: string;

  // 用户名（可选，用于显示）
  @Column({ length: 50, nullable: true })
  username: string;

  // 用于验证的nonce字段
  @Column({ nullable: true })
  nonce: string;

  // 头像URL字段
  @Column({ nullable: true })
  avatarUrl: string;

  // ENS域名字段（可选）
  @Column({ nullable: true })
  ensName: string;

  // 最后登录时间
  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
