import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'sdfasas',
    });
  }

  async validate(payload: any) {
    // 验证用户是否存在
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    
    // 返回的对象将被附加到Request对象上
    return { 
      id: payload.sub, 
      walletAddress: payload.walletAddress,
      username: payload.username 
    };
  }
}
