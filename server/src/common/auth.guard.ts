import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService, JwtPayload } from '../auth/auth.service';

export interface AuthedRequest extends Request {
  user: JwtPayload;
}

/** Достаёт JWT из httpOnly-куки и кладёт payload в req.user */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const cookieName = this.config.get<string>('COOKIE_NAME', 'mell_token');
    const token = req.cookies?.[cookieName];

    if (!token) throw new UnauthorizedException('Не авторизован');

    try {
      req.user = this.auth.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('Сессия истекла, войдите заново');
    }
  }
}
