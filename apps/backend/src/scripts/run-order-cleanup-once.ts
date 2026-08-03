/**
 * One-off: bootstrap Nest and run stale-order cleanup against the configured env.
 *
 * From repo root (uses AWS Secrets Manager like main.ts):
 *   NODE_ENV=development DEPLOYMENT_ENV=development npx ts-node -r tsconfig-paths/register \
 *     apps/backend/src/scripts/run-order-cleanup-once.ts
 */
import { webcrypto } from 'node:crypto';
if (typeof (globalThis as unknown as { crypto?: unknown }).crypto === 'undefined') {
  (globalThis as unknown as { crypto: unknown }).crypto = webcrypto;
}

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app/app.module';
import { configureRuntimeDns } from '../config/configure-runtime-dns';
import { OrderCleanupService } from '../orders/order-cleanup.service';

configureRuntimeDns();

async function loadSecrets(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const deploymentEnv = process.env.DEPLOYMENT_ENV || nodeEnv;
  const secretName =
    deploymentEnv === 'production'
      ? 'production-rendasua-backend-secrets'
      : 'development-rendasua-backend-secrets';
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'ca-central-1',
  });
  const data = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const secrets = JSON.parse(data.SecretString || '{}') as Record<string, string>;
  for (const [key, value] of Object.entries(secrets)) {
    if (!process.env[key]) process.env[key] = String(value);
  }
  console.log(`Loaded secrets from ${secretName}`);
}

async function main(): Promise<void> {
  await loadSecrets();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const cleanup = app.get(OrderCleanupService);
    const result = await cleanup.runDailyCleanup();
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error: any) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
