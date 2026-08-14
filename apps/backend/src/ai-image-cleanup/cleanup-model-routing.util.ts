import { VALIDATION_CODES } from '../image-validation/types/image-validation.types';

export const OPENAI_IMAGE_CLEANUP_MODEL_CONFIG_KEY =
  'openai_image_cleanup_model';

export const DEFAULT_OPENAI_IMAGE_CLEANUP_MODEL = 'gpt-image-1-mini' as const;

export type OpenAiImageCleanupModel = 'gpt-image-1-mini' | 'gpt-image-1.5';

export type CleanupRouteDecision = 'skip' | OpenAiImageCleanupModel;

/** Codes that warrant an OpenAI image edit (not DUPLICATE_IMAGE alone). */
export const CLEANUP_WORTHY_CODES = new Set<string>([
  VALIDATION_CODES.CLUTTERED_BACKGROUND,
  VALIDATION_CODES.POOR_LIGHTING,
  VALIDATION_CODES.TOO_MUCH_TEXT,
  VALIDATION_CODES.PRODUCT_TOO_SMALL,
  VALIDATION_CODES.LOW_RESOLUTION,
  VALIDATION_CODES.IMAGE_BLURRY,
]);

export function parseOpenAiImageCleanupModel(
  value: string | null | undefined
): OpenAiImageCleanupModel {
  const trimmed = value?.trim();
  if (trimmed === 'gpt-image-1.5') return 'gpt-image-1.5';
  return DEFAULT_OPENAI_IMAGE_CLEANUP_MODEL;
}

export function extractValidationCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (entry && typeof entry === 'object' && 'code' in entry) {
        return String((entry as { code: unknown }).code);
      }
      return null;
    })
    .filter((code): code is string => !!code);
}

/**
 * Decide whether to skip cleanup or which Images model to use.
 * Admin `gpt-image-1.5` forces that model for all edits; mini may upgrade blurry shots.
 * When `explicitRequest` is true (merchant opted in / tapped Enhance), catalog-ready
 * skip is disabled because local validators cannot detect clutter/text/size issues.
 */
export function routeCleanupModel(input: {
  adminDefaultModel: OpenAiImageCleanupModel;
  issueCodes: string[];
  errorCodes?: string[];
  qualityScore?: number | null;
  width?: number | null;
  height?: number | null;
  /** User-initiated cleanup — still edit when no local cleanup codes are present. */
  explicitRequest?: boolean;
}): CleanupRouteDecision {
  const codes = [...new Set(input.issueCodes)];
  const errors = [...new Set(input.errorCodes ?? [])];
  if (errors.includes(VALIDATION_CODES.INAPPROPRIATE_CONTENT)) {
    return 'skip';
  }
  if (codes.includes(VALIDATION_CODES.INAPPROPRIATE_CONTENT)) {
    return 'skip';
  }
  const needsCleanup = codes.some((c) => CLEANUP_WORTHY_CODES.has(c));
  if (!needsCleanup) {
    if (input.explicitRequest) {
      return pickModel(input.adminDefaultModel, codes);
    }
    return 'skip';
  }
  return pickModel(input.adminDefaultModel, codes);
}

function pickModel(
  adminDefaultModel: OpenAiImageCleanupModel,
  codes: string[]
): OpenAiImageCleanupModel {
  // Only use expensive 1.5 model when explicitly set by admin
  // Blurry images now use mini to reduce costs (1.5 is 3-4x more expensive)
  if (adminDefaultModel === 'gpt-image-1.5') {
    return 'gpt-image-1.5';
  }
  return 'gpt-image-1-mini';
}
