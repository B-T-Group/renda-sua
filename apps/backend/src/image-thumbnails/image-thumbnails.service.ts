import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import sharp from 'sharp';
import { AwsService } from '../aws/aws.service';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ImageThumbnailsQueueService } from './image-thumbnails-queue.service';
import * as Q from './image-thumbnails.queries';
import {
  THUMBNAIL_JPEG_QUALITY,
  THUMBNAIL_MAX_ATTEMPTS,
  THUMBNAIL_MAX_EDGE_PX,
  THUMBNAIL_MAX_SOURCE_BYTES,
  THUMBNAIL_MAX_SOURCE_PIXELS,
  THUMBNAIL_TABLES,
  THUMBNAIL_WEBP_QUALITY,
  ThumbnailSourceRow,
  ThumbnailSourceType,
} from './image-thumbnails.types';

interface GeneratedThumb {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  contentType: string;
}

const STUCK_PROCESSING_MINUTES = 30;
const PENDING_PICKUP_MINUTES = 10;
const SWEEP_BATCH_SIZE = 50;

@Injectable()
export class ImageThumbnailsService implements OnModuleInit {
  private readonly logger = new Logger(ImageThumbnailsService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly awsService: AwsService,
    private readonly queue: ImageThumbnailsQueueService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  onModuleInit(): void {
    this.queue.registerLocalHandler(async (sourceType, imageId) => {
      await this.processOne(sourceType, imageId);
    });
  }

  private isEnabled(): boolean {
    return process.env.IMAGE_THUMBNAILS_ENABLED !== 'false';
  }

  /** Fire-and-forget enqueue after an image row is created (never throws). */
  async enqueueGeneration(
    sourceType: ThumbnailSourceType,
    imageId: string
  ): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      await this.queue.enqueue(sourceType, imageId);
    } catch (error: any) {
      this.logger.error(
        `Thumbnail enqueue failed for ${sourceType}/${imageId}: ${error?.message ?? error}`
      );
    }
  }

  async enqueueMany(
    sourceType: ThumbnailSourceType,
    imageIds: string[]
  ): Promise<void> {
    for (const id of imageIds) {
      await this.enqueueGeneration(sourceType, id);
    }
  }

  /** Worker entry point (internal API / inline handler). Idempotent via claim. */
  async processOne(
    sourceType: ThumbnailSourceType,
    imageId: string
  ): Promise<{ success: boolean; status: string }> {
    const row = await this.claim(sourceType, imageId);
    if (!row) {
      this.logger.log(
        `Thumbnail ${sourceType}/${imageId} not claimable; skipping`
      );
      return { success: true, status: 'not_claimed' };
    }
    if (row.thumbnail_attempts > THUMBNAIL_MAX_ATTEMPTS) {
      await this.markFailed(sourceType, row, 'Max attempts exceeded');
      return { success: true, status: 'failed' };
    }
    return this.generateAndPersist(sourceType, row);
  }

  private async generateAndPersist(
    sourceType: ThumbnailSourceType,
    row: ThumbnailSourceRow
  ): Promise<{ success: boolean; status: string }> {
    try {
      const source = await this.downloadSource(row);
      if (!source) {
        await this.markSkipped(sourceType, row, 'Source not in app bucket');
        return { success: true, status: 'skipped' };
      }
      const thumb = await this.generateThumb(source);
      const uploaded = await this.uploadThumb(sourceType, row, thumb);
      await this.markReady(sourceType, row, thumb, uploaded);
      return { success: true, status: 'ready' };
    } catch (error: any) {
      const message = (error?.message ?? 'Thumbnail generation failed').slice(
        0,
        500
      );
      this.logger.warn(
        `Thumbnail failed for ${sourceType}/${row.id}: ${message}`
      );
      await this.markFailed(sourceType, row, message);
      return { success: false, status: 'failed' };
    }
  }

  /** Atomically claim pending/failed row; null when another worker owns it. */
  private async claim(
    sourceType: ThumbnailSourceType,
    imageId: string
  ): Promise<ThumbnailSourceRow | null> {
    const table = THUMBNAIL_TABLES[sourceType];
    const data = await this.hasura.executeMutation<
      Record<
        string,
        { affected_rows: number; returning: ThumbnailSourceRow[] }
      >
    >(Q.claimMutation(sourceType), {
      id: imageId,
      now: new Date().toISOString(),
    });
    const result = data[`update_${table}`];
    if (!result || result.affected_rows === 0) return null;
    return result.returning[0] ?? null;
  }

  private async downloadSource(
    row: ThumbnailSourceRow
  ): Promise<Buffer | null> {
    const key = row.s3_key || this.deriveKeyFromUrl(row.image_url);
    if (!key) return null;
    const response = await this.awsService.getS3Client().send(
      new GetObjectCommand({ Bucket: this.bucketName(), Key: key })
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error('Empty S3 object body');
    }
    if (bytes.length > THUMBNAIL_MAX_SOURCE_BYTES) {
      throw new Error(
        `Source exceeds ${THUMBNAIL_MAX_SOURCE_BYTES} bytes (${bytes.length})`
      );
    }
    return Buffer.from(bytes);
  }

  /** Only URLs pointing at our own bucket may be fetched (SSRF guard). */
  private deriveKeyFromUrl(imageUrl: string): string | null {
    try {
      const url = new URL(imageUrl);
      const bucket = this.bucketName();
      const validHost =
        url.hostname === `${bucket}.s3.amazonaws.com` ||
        (url.hostname.startsWith(`${bucket}.s3.`) &&
          url.hostname.endsWith('.amazonaws.com'));
      if (!validHost) return null;
      return decodeURIComponent(url.pathname.replace(/^\//, '')) || null;
    } catch {
      return null;
    }
  }

  private async generateThumb(source: Buffer): Promise<GeneratedThumb> {
    const pipeline = sharp(source, {
      limitInputPixels: THUMBNAIL_MAX_SOURCE_PIXELS,
    })
      .rotate()
      .resize(THUMBNAIL_MAX_EDGE_PX, THUMBNAIL_MAX_EDGE_PX, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    try {
      const { data, info } = await pipeline
        .clone()
        .webp({ quality: THUMBNAIL_WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return {
        buffer: data,
        width: info.width,
        height: info.height,
        format: 'webp',
        contentType: 'image/webp',
      };
    } catch (error: any) {
      this.logger.warn(`WebP encode failed, falling back to JPEG: ${error?.message}`);
      const { data, info } = await pipeline
        .jpeg({ quality: THUMBNAIL_JPEG_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return {
        buffer: data,
        width: info.width,
        height: info.height,
        format: 'jpeg',
        contentType: 'image/jpeg',
      };
    }
  }

  private async uploadThumb(
    sourceType: ThumbnailSourceType,
    row: ThumbnailSourceRow,
    thumb: GeneratedThumb
  ): Promise<{ url: string; key: string }> {
    const bucket = this.bucketName();
    const region = this.configService.get('aws')?.region || 'ca-central-1';
    const prefix = row.business_id
      ? `businesses/${row.business_id}/thumbs`
      : 'thumbs';
    const ext = thumb.format === 'webp' ? 'webp' : 'jpg';
    const key = `${prefix}/${sourceType}/${row.id}/${Date.now()}.${ext}`;
    await this.awsService.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: thumb.buffer,
        ContentType: thumb.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
      key,
    };
  }

  private bucketName(): string {
    return (
      this.awsService.getDefaultBucketName() ||
      process.env.S3_BUCKET_NAME ||
      'rendasua-uploads'
    );
  }

  private async markReady(
    sourceType: ThumbnailSourceType,
    row: ThumbnailSourceRow,
    thumb: GeneratedThumb,
    uploaded: { url: string; key: string }
  ): Promise<void> {
    const table = THUMBNAIL_TABLES[sourceType];
    const data = await this.hasura.executeMutation<
      Record<string, { affected_rows: number }>
    >(Q.markReadyMutation(sourceType), {
      id: row.id,
      sourceImageUrl: row.image_url,
      thumbnail: uploaded.url,
      s3Key: uploaded.key,
      width: thumb.width,
      height: thumb.height,
      format: thumb.format,
      bytes: thumb.buffer.length,
      now: new Date().toISOString(),
    });
    if ((data[`update_${table}`]?.affected_rows ?? 0) === 0) {
      this.logger.warn(
        `Discarded stale thumbnail for ${sourceType}/${row.id}: row was reset or re-claimed`
      );
    }
  }

  private async markFailed(
    sourceType: ThumbnailSourceType,
    row: ThumbnailSourceRow,
    error: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      Q.markFailedMutation(sourceType, 'failed'),
      { id: row.id, sourceImageUrl: row.image_url, error }
    );
  }

  private async markSkipped(
    sourceType: ThumbnailSourceType,
    row: ThumbnailSourceRow,
    reason: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      Q.markFailedMutation(sourceType, 'skipped'),
      { id: row.id, sourceImageUrl: row.image_url, error: reason }
    );
  }

  /** Reset one image and enqueue regeneration (async). */
  async regenerate(
    sourceType: ThumbnailSourceType,
    imageId: string
  ): Promise<{ queued: number }> {
    await this.hasura.executeMutation(Q.resetToPendingMutation(sourceType), {
      id: imageId,
    });
    await this.enqueueGeneration(sourceType, imageId);
    return { queued: 1 };
  }

  /** Enqueue a page of rows missing thumbnails; returns a keyset cursor per source type. */
  async backfill(
    sourceTypes: ThumbnailSourceType[],
    limit: number,
    cursors?: Partial<Record<ThumbnailSourceType, string>>,
    statuses: string[] = ['pending', 'failed']
  ): Promise<{
    queued: number;
    cursors: Partial<Record<ThumbnailSourceType, string | null>>;
  }> {
    let queued = 0;
    const nextCursors: Partial<Record<ThumbnailSourceType, string | null>> =
      {};
    for (const sourceType of sourceTypes) {
      const page = await this.loadBackfillPage(
        sourceType,
        statuses,
        limit,
        cursors?.[sourceType]
      );
      for (const row of page) {
        await this.enqueueGeneration(sourceType, row.id);
        queued += 1;
      }
      nextCursors[sourceType] = page.length
        ? page[page.length - 1].created_at
        : null;
    }
    return { queued, cursors: nextCursors };
  }

  private async loadBackfillPage(
    sourceType: ThumbnailSourceType,
    statuses: string[],
    limit: number,
    after?: string
  ): Promise<{ id: string; created_at: string }[]> {
    const table = THUMBNAIL_TABLES[sourceType];
    const data = await this.hasura.executeQuery<
      Record<string, { id: string; created_at: string }[]>
    >(Q.backfillQuery(sourceType), {
      statuses,
      maxAttempts: THUMBNAIL_MAX_ATTEMPTS,
      after: after ?? '1970-01-01T00:00:00Z',
      limit,
    });
    return data[table] ?? [];
  }

  /** Cron sweeper: recover stuck processing rows and pick up never-enqueued pending rows. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepStuckProcessing(): Promise<void> {
    if (!this.isEnabled()) return;
    for (const sourceType of Object.keys(
      THUMBNAIL_TABLES
    ) as ThumbnailSourceType[]) {
      await this.sweepSource(sourceType);
    }
  }

  private async sweepSource(sourceType: ThumbnailSourceType): Promise<void> {
    try {
      await this.releaseAndRequeueStuck(sourceType);
      await this.enqueueUnprocessedPending(sourceType);
    } catch (error: any) {
      this.logger.error(
        `Thumbnail sweep failed for ${sourceType}: ${error?.message ?? error}`
      );
    }
  }

  private async releaseAndRequeueStuck(
    sourceType: ThumbnailSourceType
  ): Promise<void> {
    const table = THUMBNAIL_TABLES[sourceType];
    const before = new Date(
      Date.now() - STUCK_PROCESSING_MINUTES * 60_000
    ).toISOString();
    const data = await this.hasura.executeQuery<
      Record<string, { id: string }[]>
    >(Q.stuckProcessingQuery(sourceType), { before, limit: SWEEP_BATCH_SIZE });
    const ids = (data[table] ?? []).map((r) => r.id);
    if (!ids.length) return;
    await this.hasura.executeMutation(Q.releaseStuckMutation(sourceType), {
      ids,
    });
    await this.enqueueMany(sourceType, ids);
    this.logger.log(`Re-enqueued ${ids.length} stuck ${sourceType} thumbs`);
  }

  /** Safety net for rows inserted outside Nest (e.g. direct Hasura GraphQL). */
  private async enqueueUnprocessedPending(
    sourceType: ThumbnailSourceType
  ): Promise<void> {
    const table = THUMBNAIL_TABLES[sourceType];
    const before = new Date(
      Date.now() - PENDING_PICKUP_MINUTES * 60_000
    ).toISOString();
    const data = await this.hasura.executeQuery<
      Record<string, { id: string }[]>
    >(Q.unprocessedPendingQuery(sourceType), {
      before,
      limit: SWEEP_BATCH_SIZE,
    });
    const ids = (data[table] ?? []).map((r) => r.id);
    if (!ids.length) return;
    await this.enqueueMany(sourceType, ids);
    this.logger.log(`Enqueued ${ids.length} unprocessed ${sourceType} thumbs`);
  }
}
