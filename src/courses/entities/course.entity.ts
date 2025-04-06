export class Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;  // S3视频资源地址
  web2CourseId: string;  // Web2平台的课程ID，与链上映射
  creatorAddress: string;  // 创建者钱包地址
  createdAt: Date;
  updatedAt: Date;
}
