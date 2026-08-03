import 'reflect-metadata';
import {
  BadRequestException,
  ValidationPipe,
  VersioningType,
  type ValidationError,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { ApiValidationError } from '@rooferslabs/shared';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { MediaStreamBridge } from './telephony/media-stream.bridge';

function flattenValidationErrors(errors: ValidationError[], parent = ''): ApiValidationError[] {
  const result: ApiValidationError[] = [];
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        result.push({ field, message });
      }
    }
    if (error.children?.length) {
      result.push(...flattenValidationErrors(error.children, field));
    }
  }
  return result;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(AppConfigService);

  // Behind Cloudflare/ALB the first hop is the proxy; trust it so req.ip (used
  // by rate limiting and logs) reflects the real client.
  app.set('trust proxy', 1);

  // Security headers. CSP is relaxed for the Swagger UI in non-production.
  app.use(helmet({ contentSecurityPolicy: config.isProduction ? undefined : false }));

  // Strict CORS: only the configured origins (never a wildcard), falling back
  // to the web app's public URL so a misconfigured CORS_ORIGINS fails closed.
  app.enableCors({
    origin: config.api.corsOrigins.length ? config.api.corsOrigins : [config.api.webPublicUrl],
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  // URI versioning → routes are served under /v1/...
  app.enableVersioning({ type: VersioningType.URI, prefix: 'v', defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) => {
        const validationErrors = flattenValidationErrors(errors as ValidationError[]);
        // Consumed by AllExceptionsFilter to emit the standard error envelope.
        return new BadRequestException({ message: 'Validation failed.', validationErrors });
      },
    }),
  );

  app.enableShutdownHooks();

  // Attach the Twilio Media Streams WebSocket bridge to the HTTP server on
  // /v1/telephony/media-stream (a raw WebSocket, not socket.io).
  const mediaStreamPath = '/v1/telephony/media-stream';
  const wss = new WebSocketServer({ noServer: true });
  const bridge = app.get(MediaStreamBridge);
  wss.on('connection', (socket) => bridge.handleConnection(socket));

  const httpServer = app.getHttpServer();
  httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(request.url ?? '', 'http://localhost');
    if (pathname === mediaStreamPath) {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    } else {
      socket.destroy();
    }
  });
  // Close active media streams during shutdown so in-flight calls finalize.
  httpServer.on('close', () => {
    for (const client of wss.clients) client.close();
    wss.close();
  });

  // OpenAPI / Swagger documentation at /docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('rooferslabs API')
    .setDescription('AI-Powered Front Office Platform for roofing companies (r1 echo).')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(config.api.port, '0.0.0.0');
  logger.log(
    `rooferslabs API listening on ${config.api.publicUrl} ` +
      `(tier: ${config.tier}, node: ${config.env}) — docs at /docs`,
    'Bootstrap',
  );
}

void bootstrap();
