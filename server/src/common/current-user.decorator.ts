import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.service';
import { AuthedRequest } from './auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
