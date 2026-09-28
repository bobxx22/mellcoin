import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface JwtPayload {
  sub: string;
  username: string;
}

export interface AuthResult {
  token: string;
  user: { id: string; username: string; displayName: string };
}

@Injectable()
export class AuthService {
  private static readonly SALT_ROUNDS = 10;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.users.findByUsername(dto.username);
    if (existing) throw new ConflictException('Такой логин уже занят');

    const passwordHash = await bcrypt.hash(dto.password, AuthService.SALT_ROUNDS);
    const user = await this.users.create(dto.username, passwordHash);

    return this.issue(user.id, user.username, user.displayName);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByUsernameWithPassword(dto.username);
    // Хешируем всегда, чтобы время ответа не выдавало существование логина
    const hash = user?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu';
    const valid = await bcrypt.compare(dto.password, hash);

    if (!user || !valid) throw new UnauthorizedException('Неверный логин или пароль');

    return this.issue(user.id, user.username, user.displayName);
  }

  verify(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token);
  }

  private issue(id: string, username: string, displayName: string): AuthResult {
    const payload: JwtPayload = { sub: id, username };
    return {
      token: this.jwt.sign(payload),
      user: { id, username, displayName },
    };
  }
}
