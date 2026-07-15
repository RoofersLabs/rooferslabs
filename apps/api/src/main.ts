import 'reflect-metadata';
import {
  BadRequestException,
  ValidationPipe,
  VersioningType,
  type ValidationError,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import type { ApiValidationError } from '@rooferslabs/shared';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

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
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(AppConfigService);

  // Security headers. CSP is relaxed for the Swagger UI in non-production.
  app.use(helmet({ contentSecurityPolicy: config.isProduction ? undefined : false }));

  app.enableCors({
    origin: config.api.corsOrigins.length ? config.api.corsOrigins : true,
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

  // OpenAPI / Swagger documentation at /docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('RoofersLabs API')
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
    `RoofersLabs API listening on ${config.api.publicUrl} (env: ${config.env}) — docs at /docs`,
    'Bootstrap',
  );
}

void bootstrap();
