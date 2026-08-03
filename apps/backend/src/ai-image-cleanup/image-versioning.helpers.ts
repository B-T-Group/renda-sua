import type { AiImageCleanupResultRow } from './ai-image-cleanup.types';
import { calculateScore } from '../image-validation/utils/score-calculator.util';
import { VALIDATION_CODES } from '../image-validation/types/image-validation.types';

/** OpenAI image-edit size used by AiService.cleanupProductImage. */
export const AI_CLEANUP_OUTPUT_SIZE = 1024;

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

export function stripResolutionIssues(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw ?? [];
  return raw.filter((entry) => {
    if (entry && typeof entry === 'object' && 'code' in entry) {
      return (
        String((entry as { code: unknown }).code) !==
        VALIDATION_CODES.LOW_RESOLUTION
      );
    }
    return true;
  });
}

export function buildApplyPatch(args: {
  result: Pick<
    AiImageCleanupResultRow,
    | 'cleaned_image_url'
    | 'cleaned_s3_key'
    | 'original_image_url'
    | 'original_s3_key'
  >;
  row: {
    original_image_url: string | null;
    original_s3_key: string | null;
    s3_key: string | null;
    content_hash?: string | null;
    validation_warnings?: unknown;
    validation_errors?: unknown;
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
  const validation_warnings = stripResolutionIssues(
    args.row.validation_warnings
  );
  const validation_errors = stripResolutionIssues(args.row.validation_errors);
  const remainingIssues = [
    ...(Array.isArray(validation_errors) ? validation_errors : []),
    ...(Array.isArray(validation_warnings) ? validation_warnings : []),
  ] as Array<{ code: string; message?: string; severity?: string }>;
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
    width: AI_CLEANUP_OUTPUT_SIZE,
    height: AI_CLEANUP_OUTPUT_SIZE,
    validation_warnings,
    validation_errors,
    quality_score: calculateScore(
      remainingIssues.map((issue) => ({
        code: issue.code,
        message: issue.message ?? '',
        severity: (issue.severity as 'error' | 'warning') ?? 'warning',
      }))
    ),
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
