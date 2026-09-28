import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GameIoAdapter } from './common/socket-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT', '3000'));
  const origins = config
    .get<string>('CLIENT_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: origins, credentials: true });
  app.useWebSocketAdapter(new GameIoAdapter(app, origins));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  await app.listen(port);
  new Logger('Bootstrap').log(
    `MELLCOIN API на http://localhost:${port}/api  •  WS ws://localhost:${port}  •  клиент: ${origins.join(', ')}`,
  );
}

void bootstrap();
