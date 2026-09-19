/**
 * One-off: run daily platform-sponsored AI reel generation against the
 * configured env (no ScheduleModule / no prod cron side-effects).
 *
 * From repo root (after nx build backend):
 *   NODE_ENV=production DEPLOYMENT_ENV=production \
 *     node dist/apps/backend/src/scripts/run-reel-auto-generate-once.js
 */
import { webcrypto } from 'node:crypto';
if (
  typeof (globalThis as unknown as { crypto?: unknown }).crypto === 'undefined'
) {
  (globalThis as unknown as { crypto: unknown }).crypto = webcrypto;
}

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { AwsModule } from '../aws/aws.module';
import configuration from '../config/configuration';
import { configureRuntimeDns } from '../config/configure-runtime-dns';
import { HasuraModule } from '../hasura/hasura.module';
import { ReelMerchantNotifyService } from '../notifications/reel-merchant-notify.service';
import { RbacService } from '../rbac/rbac.service';
import { ReelAiTokensService } from '../reel-ai-tokens/reel-ai-tokens.service';
import { ReelMediaQueueService } from '../reels/reel-media-queue.service';
import { ReelAiGenerateService } from '../reel-ai-generate/reel-ai-generate.service';
import { ReelAutoGenerateService } from '../reel-ai-generate/reel-auto-generate.service';
import { VeoReelClient } from '../reel-ai-generate/veo-reel-client';
import { GoogleVideoGenerationProvider } from '../reel-ai-generate/video-generation/providers/google-video-generation.provider';
import { RunwayReelClient } from '../reel-ai-generate/video-generation/providers/runway-reel-client';
import { RunwayVideoGenerationProvider } from '../reel-ai-generate/video-generation/providers/runway-video-generation.provider';
import { VideoGenerationRouter } from '../reel-ai-generate/video-generation/video-generation-router.service';

configureRuntimeDns();

const FORCE_SECRET_KEYS = new Set([
  'HASURA_GRAPHQL_ADMIN_SECRET',
  'HASURA_GRAPHQL_ENDPOINT',
  'DATABASE_URL',
  'REEL_AUTO_GENERATE_ENABLED',
  'REEL_AUTO_GENERATE_CRON',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
  'RUNWAY_API_KEY',
  'REELS_BUCKET_NAME',
  'REELS_CLOUDFRONT_DOMAIN',
  'REEL_MEDIA_QUEUE_URL',
]);

async function loadSecrets(): Promise<void> {
  const deploymentEnv =
    process.env.DEPLOYMENT_ENV || process.env.NODE_ENV || 'development';
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
  const secrets = JSON.parse(data.SecretString || '{}') as Record<
    string,
    string
  >;
  for (const [key, value] of Object.entries(secrets)) {
    if (!process.env[key] || FORCE_SECRET_KEYS.has(key)) {
      process.env[key] = String(value);
    }
  }
  process.env.REEL_AUTO_GENERATE_ENABLED = 'true';
  if (deploymentEnv === 'production' && !process.env.HASURA_GRAPHQL_ENDPOINT) {
    process.env.HASURA_GRAPHQL_ENDPOINT =
      'https://hasura.rendasua.com/v1/graphql';
  }
  console.log(
    `Loaded secrets from ${secretName}; hasura=${process.env.HASURA_GRAPHQL_ENDPOINT}`
  );
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ClsModule.forRoot({ global: true }),
    AwsModule,
    HasuraModule,
  ],
  providers: [
    ReelMediaQueueService,
    VeoReelClient,
    RunwayReelClient,
    GoogleVideoGenerationProvider,
    RunwayVideoGenerationProvider,
    VideoGenerationRouter,
    {
      provide: RbacService,
      useValue: { getEffectiveAccess: async () => ({ isSuperuser: true }) },
    },
    {
      provide: ReelAiTokensService,
      useValue: {
        tryReserveTokens: async () => 0,
        refundTokens: async () => undefined,
        recordUsage: async () => undefined,
      },
    },
    {
      provide: ReelMerchantNotifyService,
      useValue: { notifyFailed: async () => undefined },
    },
    ReelAiGenerateService,
    ReelAutoGenerateService,
  ],
})
class ReelAutoGenerateOnceModule {}

async function main(): Promise<void> {
  await loadSecrets();
  const app = await NestFactory.createApplicationContext(
    ReelAutoGenerateOnceModule,
    { logger: ['error', 'warn', 'log'] }
  );
  try {
    const autoGenerate = app.get(ReelAutoGenerateService);
    const candidate = await autoGenerate.tryCreateDailySponsoredReel();
    console.log(
      JSON.stringify(
        { success: true, created: Boolean(candidate), candidate },
        null,
        2
      )
    );
  } finally {
    await app.close();
  }
}

main().catch((error: any) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
