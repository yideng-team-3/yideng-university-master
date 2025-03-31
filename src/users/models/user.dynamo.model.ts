import { v4 as uuidv4 } from 'uuid';

export class DynamoUser {
  id: string; // 修改为字符串类型
  walletAddress: string;
  username: string;
  nonce: string;
  avatarUrl?: string;
  ensName?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  
  constructor(partial: Partial<DynamoUser>) {
    // 默认值设置
    this.id = partial.id || uuidv4();
    this.isActive = partial.isActive ?? true;
    this.createdAt = partial.createdAt || new Date().toISOString();
    this.updatedAt = partial.updatedAt || new Date().toISOString();
    
    // 其他属性
    Object.assign(this, partial);
  }
  
  // 将实体转换为 DynamoDB 项
  toDynamoItem(): Record<string, any> {
    return {
      ...this,
      // 处理可能为 undefined 的字段
      avatarUrl: this.avatarUrl || null,
      ensName: this.ensName || null,
    };
  }
  
  // 从 DynamoDB 项创建实体
  static fromDynamoItem(item?: Record<string, any>): DynamoUser | null {
    if (!item) return null;
    return new DynamoUser({
      id: item.id,
      walletAddress: item.walletAddress,
      username: item.username,
      nonce: item.nonce,
      avatarUrl: item.avatarUrl,
      ensName: item.ensName,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isActive: item.isActive,
    });
  }
}
