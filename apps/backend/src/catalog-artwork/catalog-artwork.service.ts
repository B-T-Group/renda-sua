import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { AiService } from '../ai/ai.service';
import { AwsService } from '../aws/aws.service';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { buildCatalogArtworkPrompt } from './catalog-artwork.prompt';

const BACKFILL_BATCH = 3;

interface ArtworkSource {
  id: number | string;
  name: string;
  description: string | null;
  image_url: string | null;
}

@Injectable()
export class CatalogArtworkService {
  private readonly logger = new Logger(CatalogArtworkService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly awsService: AwsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly hasura: HasuraSystemService
  ) {}

  scheduleCategoryArtwork(categoryId: number): void {
    void this.ensureCategoryArtwork(categoryId).catch((error: any) => {
      this.warnSkip('category', categoryId, error);
    });
  }

  scheduleCollectionArtwork(collectionId: string): void {
    void this.ensureCollectionArtwork(collectionId).catch((error: any) => {
      this.warnSkip('collection', collectionId, error);
    });
  }

  async ensureCategoryArtwork(categoryId: number): Promise<void> {
    const row = await this.loadCategory(categoryId);
    if (!row || row.image_url) return;
    const url = await this.createArtwork(row, 'category');
    await this.saveCategoryImage(categoryId, url);
  }

  async ensureCollectionArtwork(collectionId: string): Promise<void> {
    const row = await this.loadCollection(collectionId);
    if (!row || row.image_url) return;
    const url = await this.createArtwork(row, 'collection');
    await this.saveCollectionImage(collectionId, url);
  }

  async runHourlyBackfill(): Promise<{ queued: number }> {
    const categories = await this.categoriesMissingArtwork();
    const collections = await this.collectionsMissingArtwork();
    await this.backfillCategories(categories);
    await this.backfillCollections(collections);
    return { queued: categories.length + collections.length };
  }

  private async backfillCategories(rows: Array<{ id: number }>): Promise<void> {
    for (const row of rows) {
      await this.ensureCategoryArtwork(row.id).catch((error: any) => {
        this.warnSkip('category', row.id, error);
      });
    }
  }

  private async backfillCollections(
    rows: Array<{ id: string }>
  ): Promise<void> {
    for (const row of rows) {
      await this.ensureCollectionArtwork(row.id).catch((error: any) => {
        this.warnSkip('collection', row.id, error);
      });
    }
  }

  private async createArtwork(
    row: ArtworkSource,
    kind: 'category' | 'collection'
  ): Promise<string> {
    const prompt = buildCatalogArtworkPrompt({
      name: row.name,
      description: row.description,
      kind,
    });
    const generated = await this.aiService.generateCatalogArtwork(prompt);
    return this.uploadArtwork(kind, String(row.id), generated.b64_json);
  }

  private async uploadArtwork(
    kind: string,
    id: string,
    b64: string
  ): Promise<string> {
    const bucket = this.bucketName();
    const region = this.configService.get('aws')?.region || 'ca-central-1';
    const key = `catalog-artwork/${kind}/${id}.jpg`;
    await this.awsService.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(b64, 'base64'),
        ContentType: 'image/jpeg',
      })
    );
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private bucketName(): string {
    return (
      this.awsService.getDefaultBucketName() ||
      process.env.S3_BUCKET_NAME ||
      'rendasua-uploads'
    );
  }

  private warnSkip(kind: string, id: number | string, error: any): void {
    this.logger.warn(
      `${kind} artwork skipped id=${id}: ${error?.message ?? error}`
    );
  }

  private async loadCategory(id: number): Promise<ArtworkSource | null> {
    const result = await this.hasura.executeQuery(
      `query CategoryArtwork($id: Int!) {
        item_categories_by_pk(id: $id) {
          id name description image_url
        }
      }`,
      { id }
    );
    const row = result.item_categories_by_pk;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      image_url: row.image_url ?? null,
    };
  }

  private async loadCollection(id: string): Promise<ArtworkSource | null> {
    const result = await this.hasura.executeQuery(
      `query CollectionArtwork($id: uuid!) {
        collections_by_pk(id: $id) {
          id name_en description_en image_url
        }
      }`,
      { id }
    );
    const row = result.collections_by_pk;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name_en,
      description: row.description_en ?? null,
      image_url: row.image_url ?? null,
    };
  }

  private async saveCategoryImage(id: number, url: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation SaveCategoryArtwork($id: Int!, $url: String!) {
        update_item_categories(
          where: { id: { _eq: $id }, image_url: { _is_null: true } }
          _set: { image_url: $url }
        ) { affected_rows }
      }`,
      { id, url }
    );
  }

  private async saveCollectionImage(id: string, url: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation SaveCollectionArtwork($id: uuid!, $url: String!) {
        update_collections(
          where: { id: { _eq: $id }, image_url: { _is_null: true } }
          _set: { image_url: $url }
        ) { affected_rows }
      }`,
      { id, url }
    );
  }

  private async categoriesMissingArtwork(): Promise<Array<{ id: number }>> {
    const result = await this.hasura.executeQuery(
      `query CategoriesMissingArtwork($limit: Int!) {
        item_categories(
          where: { status: { _eq: active }, image_url: { _is_null: true } }
          limit: $limit
          order_by: { name: asc }
        ) { id }
      }`,
      { limit: BACKFILL_BATCH }
    );
    return result.item_categories ?? [];
  }

  private async collectionsMissingArtwork(): Promise<Array<{ id: string }>> {
    const result = await this.hasura.executeQuery(
      `query CollectionsMissingArtwork($limit: Int!) {
        collections(
          where: { image_url: { _is_null: true } }
          limit: $limit
          order_by: [{ is_featured: desc }, { sort_order: asc }]
        ) { id }
      }`,
      { limit: BACKFILL_BATCH }
    );
    return result.collections ?? [];
  }
}
