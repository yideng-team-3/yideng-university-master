import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // 对 OPTIONS 请求直接放行
    if (request.method === 'OPTIONS') {
      return true;
    }
    
    // 检查是否为公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }

    // 记录授权头但不记录完整令牌
    this.logger.debug(`接收到授权请求，Authorization header 存在: ${!!request.headers.authorization}`);
    
    // 返回认证结果
    return super.canActivate(context);
  }

  // 重写处理请求方法，提供更好的错误信息
  handleRequest(err, user, info) {
    if (err || !user) {
      // 记录详细错误信息
      this.logger.error(`认证失败: ${err?.message || '未授权'}`);
      
      // 如果有特定错误则抛出，否则抛出通用未授权错误
      if (err) {
        throw err;
      } else if (info) {
        // JWT 特定错误信息
        const message = typeof info === 'string' ? info : info.message || 'Unauthorized';
        this.logger.error(`JWT错误: ${message}`);
        throw new UnauthorizedException(message);
      } else {
        throw new UnauthorizedException('Invalid token or unauthorized access');
      }
    }
    return user;
  }
}