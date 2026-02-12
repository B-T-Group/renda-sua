/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

// Polyfill global crypto for Node 18 (global crypto is available in Node 19+)
import { webcrypto } from 'node:crypto';
if (typeof (globalThis as unknown as { crypto?: unknown }).crypto === 'undefined') {
  (globalThis as unknown as { crypto: unknown }).crypto = webcrypto;
}

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app/app.module';

async function loadSecrets() {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'ca-central-1',
  });

  // More explicit environment detection
  const nodeEnv = process.env.NODE_ENV || 'development';
  const deploymentEnv = process.env.DEPLOYMENT_ENV || nodeEnv;

  const secretName =
    deploymentEnv === 'production'
      ? 'production-rendasua-backend-secrets'
      : 'development-rendasua-backend-secrets';

  console.log(
    `Loading secrets for environment: ${deploymentEnv} (NODE_ENV: ${nodeEnv})`
  );
  console.log(`Using secret name: ${secretName}`);

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const data = await client.send(command);

    let secrets: Record<string, string> = {};

    if (data.SecretString) {
      secrets = JSON.parse(data.SecretString);
      console.log(`Successfully loaded secrets from: ${secretName}`);
    } else if (data.SecretBinary) {
      const buff = Buffer.from(data.SecretBinary as Uint8Array);
      secrets = JSON.parse(buff.toString('ascii'));
      console.log(`Successfully loaded binary secrets from: ${secretName}`);
    } else {
      console.log(`No secret data found in: ${secretName}`);
      return;
    }

    // Inject into process.env
    for (const [key, value] of Object.entries(secrets)) {
      if (!process.env[key] || key === 'HASURA_GRAPHQL_ADMIN_SECRET') {
        process.env[key] = String(value);
      }
    }
  } catch (err) {
    console.error(`Failed to load secrets from ${secretName}:`, err);
    // Continue without secrets - some may be in process.env already
  }
}

async function bootstrap() {
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/node');
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
      });
      process.on('unhandledRejection', (reason: unknown) => {
        Sentry.captureException(reason);
      });
      process.on('uncaughtException', (err: Error) => {
        Sentry.captureException(err);
        throw err;
      });
    } catch (e) {
      console.warn('Sentry init skipped:', e);
    }
  }

  // Load secrets BEFORE NestJS starts
  await loadSecrets();

  const app = await NestFactory.create(AppModule);

  // Use Winston as the NestJS logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Enable CORS for all origins
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;

  await app.listen(port);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
    'Bootstrap'
  );
  logger.log(
    `📊 Environment: ${process.env.NODE_ENV || 'development'}`,
    'Bootstrap'
  );
  logger.log(`🔧 Log Level: ${process.env.LOG_LEVEL || 'debug'}`, 'Bootstrap');
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
