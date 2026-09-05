import type {
  AiImageCleanupKind,
  AiImageCleanupResultRow,
  ImageActiveVersion,
} from './ai-image-cleanup.types';
import { calculateScore } from '../image-validation/utils/score-calculator.util';
import { VALIDATION_CODES } from '../image-validation/types/image-validation.types';

/** OpenAI image-edit size used by AiService.cleanupProductImage (JPEG). */
export const AI_CLEANUP_OUTPUT_SIZE = 1024;

/**
 * Pure helpers mirroring apply/revert race rules used by AiImageCleanupService.
 * Kept free of Nest DI so unit tests stay fast.
 */
export function shouldSkipAutoApply(args: {
  revertedAt: string | null;
  liveS3Key: string | null;
  activeVersion: ImageActiveVersion;
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

type ApplyRow = {
  original_image_url: string | null;
  original_s3_key: string | null;
  s3_key: string | null;
  content_hash?: string | null;
  validation_warnings?: unknown;
  validation_errors?: unknown;
};

function stripValidation(row: ApplyRow) {
  const validation_warnings = stripResolutionIssues(row.validation_warnings);
  const validation_errors = stripResolutionIssues(row.validation_errors);
  const remainingIssues = [
    ...(Array.isArray(validation_errors) ? validation_errors : []),
    ...(Array.isArray(validation_warnings) ? validation_warnings : []),
  ] as Array<{ code: string; message?: string; severity?: string }>;
  return {
    validation_warnings,
    validation_errors,
    quality_score: calculateScore(
      remainingIssues.map((issue) => ({
        code: issue.code,
        message: issue.message ?? '',
        severity: (issue.severity as 'error' | 'warning') ?? 'warning',
      }))
    ),
  };
}

/** Write rembg or enhanced version columns and flip the live pointer. */
export function buildApplyPatch(args: {
  result: Pick<
    AiImageCleanupResultRow,
    | 'cleaned_image_url'
    | 'cleaned_s3_key'
    | 'original_image_url'
    | 'original_s3_key'
    | 'kind'
  >;
  row: ApplyRow;
  contentHash?: string | null;
  now: string;
  kind?: AiImageCleanupKind;
}) {
  const kind = args.kind ?? args.result.kind ?? 'ai';
  const originalUrl =
    args.row.original_image_url || args.result.original_image_url;
  const originalKey =
    args.row.original_s3_key ??
    args.result.original_s3_key ??
    args.row.s3_key;
  const contentHash = args.contentHash ?? args.row.content_hash ?? null;
  const cleaned = stripValidation(args.row);
  const base = {
    original_image_url: originalUrl,
    original_s3_key: originalKey,
    image_url: args.result.cleaned_image_url,
    s3_key: args.result.cleaned_s3_key,
    reverted_at: null,
    ...cleaned,
    ...(contentHash ? { content_hash: contentHash } : {}),
  };
  if (kind === 'rembg') {
    // Rembg preserves aspect ratio (up to 1280); do not stamp AI 1024×1024.
    return {
      ...base,
      rembg_image_url: args.result.cleaned_image_url,
      rembg_s3_key: args.result.cleaned_s3_key,
      active_version: 'rembg' as const,
      is_rembg_cleaned: true,
      rembg_at: args.now,
    };
  }
  return {
    ...base,
    enhanced_image_url: args.result.cleaned_image_url,
    enhanced_s3_key: args.result.cleaned_s3_key,
    active_version: 'enhanced' as const,
    is_ai_cleaned: true,
    enhanced_at: args.now,
    width: AI_CLEANUP_OUTPUT_SIZE,
    height: AI_CLEANUP_OUTPUT_SIZE,
  };
}

/**
 * Flip live pointer back to original. Does NOT clear is_ai_cleaned /
 * is_rembg_cleaned — those mean the version still exists.
 */
export function buildRevertPatch(args: {
  originalUrl: string;
  originalKey: string | null;
  now: string;
}) {
  return {
    image_url: args.originalUrl,
    s3_key: args.originalKey,
    active_version: 'original' as const,
    reverted_at: args.now,
  };
}

/** Flip live pointer to an existing version without clearing existence flags. */
export function buildSelectVersionPatch(args: {
  version: ImageActiveVersion;
  originalUrl: string;
  originalKey: string | null;
  rembgUrl: string | null;
  rembgKey: string | null;
  enhancedUrl: string | null;
  enhancedKey: string | null;
}): {
  image_url: string;
  s3_key: string | null;
  active_version: ImageActiveVersion;
  reverted_at: string | null;
} {
  if (args.version === 'rembg') {
    if (!args.rembgUrl) {
      throw new Error('Rembg version is not available');
    }
    return {
      image_url: args.rembgUrl,
      s3_key: args.rembgKey,
      active_version: 'rembg',
      reverted_at: null,
    };
  }
  if (args.version === 'enhanced') {
    if (!args.enhancedUrl) {
      throw new Error('Enhanced version is not available');
    }
    return {
      image_url: args.enhancedUrl,
      s3_key: args.enhancedKey,
      active_version: 'enhanced',
      reverted_at: null,
    };
  }
  return {
    image_url: args.originalUrl,
    s3_key: args.originalKey,
    active_version: 'original',
    reverted_at: new Date().toISOString(),
  };
}

const VARIANT_IMAGE_UNSUPPORTED_SET_FIELDS = [
  'width',
  'height',
  'validation_warnings',
  'validation_errors',
  'quality_score',
  'validated_at',
  'perceptual_hash',
] as const;

/** Strip columns that exist on item_images but not item_variant_images. */
export function omitUnsupportedVariantImageFields(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...patch };
  for (const key of VARIANT_IMAGE_UNSUPPORTED_SET_FIELDS) {
    delete next[key];
  }
  return next;
}

export function hasExistingVersion(
  row: {
    is_ai_cleaned?: boolean;
    is_rembg_cleaned?: boolean;
    enhanced_image_url?: string | null;
    rembg_image_url?: string | null;
  },
  kind: AiImageCleanupKind
): boolean {
  if (kind === 'rembg') {
    return !!(row.is_rembg_cleaned || row.rembg_image_url);
  }
  return !!(row.is_ai_cleaned || row.enhanced_image_url);
}
