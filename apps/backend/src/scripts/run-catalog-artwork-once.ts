/**
 * One-off: generate catalog artwork for categories still missing image_url.
 *
 *   NODE_ENV=production DEPLOYMENT_ENV=production \
 *     npx ts-node --transpile-only -r tsconfig-paths/register \
 *     apps/backend/src/scripts/run-catalog-artwork-once.ts
 */
import { webcrypto } from 'node:crypto';
if (typeof (globalThis as unknown as { crypto?: unknown }).crypto === 'undefined') {
  (globalThis as unknown as { crypto: unknown }).crypto = webcrypto;
}

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { AwsModule } from '../aws/aws.module';
import { CatalogArtworkService } from '../catalog-artwork/catalog-artwork.service';
import configuration from '../config/configuration';
import { configureRuntimeDns } from '../config/configure-runtime-dns';
import { HasuraSystemService } from '../hasura/hasura-system.service';

configureRuntimeDns();

const FORCE_SECRET_KEYS = new Set([
  'HASURA_GRAPHQL_ADMIN_SECRET',
  'HASURA_GRAPHQL_ENDPOINT',
  'OPENAI_API_KEY',
  'S3_BUCKET_NAME',
  'AWS_REGION',
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
  const secrets = JSON.parse(data.SecretString || '{}') as Record<string, string>;
  applySecrets(secrets);
  if (deploymentEnv === 'production' && !process.env.HASURA_GRAPHQL_ENDPOINT) {
    process.env.HASURA_GRAPHQL_ENDPOINT = 'https://hasura.rendasua.com/v1/graphql';
  }
  console.log(`Loaded secrets from ${secretName}`);
}

function applySecrets(secrets: Record<string, string>): void {
  for (const [key, value] of Object.entries(secrets)) {
    if (!process.env[key] || FORCE_SECRET_KEYS.has(key)) {
      process.env[key] = String(value);
    }
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    AiGenerationModule,
    AwsModule,
  ],
  providers: [HasuraSystemService, CatalogArtworkService],
})
class CatalogArtworkOnceModule {}

async function main(): Promise<void> {
  await loadSecrets();
  const app = await NestFactory.createApplicationContext(CatalogArtworkOnceModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const hasura = app.get(HasuraSystemService);
    const artwork = app.get(CatalogArtworkService);
    const rows = await categoriesMissingArtwork(hasura);
    console.log(`Generating artwork for ${rows.length} categories`);
    const saved = await generateAll(artwork, rows);
    console.log(JSON.stringify({ success: true, saved }, null, 2));
  } finally {
    await app.close();
  }
}

async function categoriesMissingArtwork(hasura: HasuraSystemService) {
  const result = await hasura.executeQuery<{
    item_categories: Array<{ id: number; name: string }>;
  }>(
    `query CategoriesMissingArtwork {
      item_categories(
        where: { status: { _eq: active }, image_url: { _is_null: true } }
        order_by: { name: asc }
      ) { id name }
    }`
  );
  return result.item_categories ?? [];
}

async function generateAll(
  artwork: CatalogArtworkService,
  rows: Array<{ id: number; name: string }>
) {
  const saved: Array<{ id: number; name: string; ok: boolean; error?: string }> = [];
  for (const row of rows) {
    saved.push(await generateOne(artwork, row));
  }
  return saved;
}

async function generateOne(
  artwork: CatalogArtworkService,
  row: { id: number; name: string }
) {
  try {
    await artwork.ensureCategoryArtwork(row.id);
    console.log(`saved category ${row.id} ${row.name}`);
    return { id: row.id, name: row.name, ok: true };
  } catch (error: any) {
    const message = error?.response?.data?.error?.message || error?.message || String(error);
    console.error(`failed category ${row.id} ${row.name}: ${message}`);
    return { id: row.id, name: row.name, ok: false, error: message };
  }
}

main().catch((error: any) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
