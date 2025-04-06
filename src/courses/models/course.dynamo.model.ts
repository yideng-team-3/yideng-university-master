import { v4 as uuidv4 } from 'uuid';

export class DynamoCourse {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  contentUrl: string;
  web2CourseId: string;
  creatorAddress?: string;
  createdAt: string;
  updatedAt: string;
  
  constructor(partial: Partial<DynamoCourse>) {
    // 默认值设置
    this.id = partial.id || uuidv4();
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
      description: this.description || null,
      thumbnailUrl: this.thumbnailUrl || null,
      creatorAddress: this.creatorAddress || null,
    };
  }
  
  // 从 DynamoDB 项创建实体
  static fromDynamoItem(item?: Record<string, any>): DynamoCourse | null {
    if (!item) return null;
    return new DynamoCourse({
      id: item.id,
      title: item.title,
      description: item.description,
      thumbnailUrl: item.thumbnailUrl,
      contentUrl: item.contentUrl,
      web2CourseId: item.web2CourseId,
      creatorAddress: item.creatorAddress,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }
}
