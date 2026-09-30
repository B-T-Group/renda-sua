/**
 * One-off: generate catalog artwork for categories and collections missing image_url.
 *
 *   NODE_ENV=development DEPLOYMENT_ENV=development npx ts-node -r tsconfig-paths/register \
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
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app/app.module';
import { CatalogArtworkService } from '../catalog-artwork/catalog-artwork.service';
import { configureRuntimeDns } from '../config/configure-runtime-dns';
import { HasuraSystemService } from '../hasura/hasura-system.service';

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

async function missingArtwork(hasura: HasuraSystemService) {
  return hasura.executeQuery<{
    item_categories: Array<{ id: number; name: string; image_url: string | null }>;
    collections: Array<{ id: string; name_en: string; image_url: string | null }>;
  }>(
    `query MissingArtwork {
      item_categories(
        where: { status: { _eq: active }, image_url: { _is_null: true } }
        limit: 3
        order_by: { name: asc }
      ) { id name image_url }
      collections(
        where: { image_url: { _is_null: true } }
        limit: 3
        order_by: [{ is_featured: desc }, { sort_order: asc }]
      ) { id name_en image_url }
    }`
  );
}

async function main(): Promise<void> {
  await loadSecrets();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const before = await missingArtwork(app.get(HasuraSystemService));
    const result = await app.get(CatalogArtworkService).runHourlyBackfill();
    const after = await artworkForIds(app.get(HasuraSystemService), before);
    console.log(JSON.stringify({ success: true, ...result, before, after }, null, 2));
  } finally {
    await app.close();
  }
}

async function artworkForIds(
  hasura: HasuraSystemService,
  before: Awaited<ReturnType<typeof missingArtwork>>
) {
  const categoryIds = before.item_categories.map((row) => row.id);
  const collectionIds = before.collections.map((row) => row.id);
  return hasura.executeQuery(
    `query ArtworkAfter($categoryIds: [Int!]!, $collectionIds: [uuid!]!) {
      item_categories(where: { id: { _in: $categoryIds } }) { id name image_url }
      collections(where: { id: { _in: $collectionIds } }) { id name_en image_url }
    }`,
    { categoryIds, collectionIds }
  );
}

main().catch((error: any) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
