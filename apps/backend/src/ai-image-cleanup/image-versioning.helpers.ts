import type { AiImageCleanupResultRow } from './ai-image-cleanup.types';

/**
 * Pure helpers mirroring apply/revert race rules used by AiImageCleanupService.
 * Kept free of Nest DI so unit tests stay fast.
 */
export function shouldSkipAutoApply(args: {
  revertedAt: string | null;
  liveS3Key: string | null;
  activeVersion: 'original' | 'enhanced';
  expectedOriginalKey: string | null;
  force?: boolean;
}): boolean {
  if (args.force) return false;
  if (args.revertedAt) return true;
  if (
    args.expectedOriginalKey != null &&
    args.liveS3Key != null &&
    args.activeVersion === 'original' &&
    args.liveS3Key !== args.expectedOriginalKey
  ) {
    return true;
  }
  return false;
}

export function buildApplyPatch(args: {
  result: Pick<
    AiImageCleanupResultRow,
    'cleaned_image_url' | 'cleaned_s3_key' | 'original_image_url' | 'original_s3_key'
  >;
  row: {
    original_image_url: string | null;
    original_s3_key: string | null;
    s3_key: string | null;
    content_hash?: string | null;
  };
  contentHash?: string | null;
  now: string;
}) {
  const originalUrl =
    args.row.original_image_url || args.result.original_image_url;
  const originalKey =
    args.row.original_s3_key ??
    args.result.original_s3_key ??
    args.row.s3_key;
  const contentHash = args.contentHash ?? args.row.content_hash ?? null;
  return {
    original_image_url: originalUrl,
    original_s3_key: originalKey,
    enhanced_image_url: args.result.cleaned_image_url,
    enhanced_s3_key: args.result.cleaned_s3_key,
    image_url: args.result.cleaned_image_url,
    s3_key: args.result.cleaned_s3_key,
    active_version: 'enhanced' as const,
    is_ai_cleaned: true,
    enhanced_at: args.now,
    reverted_at: null,
    ...(contentHash ? { content_hash: contentHash } : {}),
  };
}

export function buildRevertPatch(args: {
  originalUrl: string;
  originalKey: string | null;
  now: string;
}) {
  return {
    image_url: args.originalUrl,
    s3_key: args.originalKey,
    active_version: 'original' as const,
    is_ai_cleaned: false,
    reverted_at: args.now,
  };
}
