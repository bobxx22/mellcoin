import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { UsersService } from '../users/users.service';
import { AuthResult, AuthService, JwtPayload } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  private get cookieName(): string {
    return this.config.get<string>('COOKIE_NAME', 'mell_token');
  }

  private cookieOptions(): CookieOptions {
    // secure:true браузер примет только по HTTPS. По локальному HTTP
    // (в том числе из Docker) кука с ним просто не сохранится — поэтому
    // это отдельная переменная, а не вывод из NODE_ENV.
    const secure = this.config.get<string>('COOKIE_SECURE', 'false').toLowerCase() === 'true';
    const sameSite = this.config.get<string>('COOKIE_SAMESITE', secure ? 'none' : 'lax');

    return {
      httpOnly: true,
      sameSite: sameSite as CookieOptions['sameSite'],
      secure,
      maxAge: THIRTY_DAYS_MS,
      path: '/',
    };
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult['user']> {
    const result = await this.auth.register(dto);
    res.cookie(this.cookieName, result.token, this.cookieOptions());
    return result.user;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult['user']> {
    const result = await this.auth.login(dto);
    res.cookie(this.cookieName, result.token, this.cookieOptions());
    return result.user;
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: boolean } {
    res.clearCookie(this.cookieName, { ...this.cookieOptions(), maxAge: undefined });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() payload: JwtPayload): Promise<AuthResult['user']> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new NotFoundException('Пользователь не найден');
    return { id: user.id, username: user.username, displayName: user.displayName };
  }
}
