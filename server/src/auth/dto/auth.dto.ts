import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: 'Логин: минимум 3 символа' })
  @MaxLength(20, { message: 'Логин: максимум 20 символов' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Логин: только латиница, цифры и _',
  })
  username: string;

  @IsString()
  @MinLength(6, { message: 'Пароль: минимум 6 символов' })
  @MaxLength(72, { message: 'Пароль: максимум 72 символа' })
  password: string;
}

export class LoginDto {
  @IsString()
  @MaxLength(20)
  username: string;

  @IsString()
  @MaxLength(72)
  password: string;
}
