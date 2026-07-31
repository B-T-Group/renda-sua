import {
  MIN_HEIGHT,
  MIN_WIDTH,
} from '../image-validation/services/image-quality-analyzer.service';
import { VALIDATION_CODES } from '../image-validation/types/image-validation.types';

/** Minimum stored quality score required for AI auto-approval. */
export const AI_REVIEW_MIN_APPROVE_QUALITY_SCORE = 85;

/** Below this score, reject without calling the model. */
export const AI_REVIEW_HARD_REJECT_QUALITY_SCORE = 70;

const REJECT_WARNING_CODES = new Set<string>([
  VALIDATION_CODES.LOW_RESOLUTION,
  VALIDATION_CODES.IMAGE_BLURRY,
]);

const PROPOSE_WARNING_CODES = new Set<string>([
  VALIDATION_CODES.CLUTTERED_BACKGROUND,
  VALIDATION_CODES.PRODUCT_TOO_SMALL,
  VALIDATION_CODES.POOR_LIGHTING,
  VALIDATION_CODES.TOO_MUCH_TEXT,
]);

export interface AiReviewImageQualityInput {
  id: string;
  width?: number | null;
  height?: number | null;
  validation_errors?: unknown;
  validation_warnings?: unknown;
  quality_score?: number | null;
}

export interface AiReviewImageQualityIssue {
  imageId: string;
  code: string;
  message: string;
  severity: 'reject' | 'propose';
}

export interface AiReviewImageQualityAssessment {
  mustReject: boolean;
  mustNotApprove: boolean;
  issues: AiReviewImageQualityIssue[];
}

function extractCodes(raw: unknown): string[] {
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

function isLowResolution(image: AiReviewImageQualityInput): boolean {
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  if (width > 0 && height > 0) {
    return width < MIN_WIDTH || height < MIN_HEIGHT;
  }
  return false;
}

function assessOneImage(
  image: AiReviewImageQualityInput
): AiReviewImageQualityIssue[] {
  const issues: AiReviewImageQualityIssue[] = [];
  const errorCodes = extractCodes(image.validation_errors);
  const warningCodes = extractCodes(image.validation_warnings);

  for (const code of errorCodes) {
    issues.push({
      imageId: image.id,
      code,
      message: `Image failed validation (${code}).`,
      severity: 'reject',
    });
  }

  if (
    warningCodes.includes(VALIDATION_CODES.LOW_RESOLUTION) ||
    isLowResolution(image)
  ) {
    issues.push({
      imageId: image.id,
      code: VALIDATION_CODES.LOW_RESOLUTION,
      message:
        'Image resolution is below 800800 pixels and is not acceptable for approval.',
      severity: 'reject',
    });
  }

  for (const code of warningCodes) {
    if (code === VALIDATION_CODES.LOW_RESOLUTION) continue;
    if (REJECT_WARNING_CODES.has(code)) {
      issues.push({
        imageId: image.id,
        code,
        message: `Image quality issue (${code}).`,
        severity: 'reject',
      });
      continue;
    }
    if (PROPOSE_WARNING_CODES.has(code)) {
      issues.push({
        imageId: image.id,
        code,
        message: `Image quality issue (${code}).`,
        severity: 'propose',
      });
    }
  }

  const score = image.quality_score;
  if (score != null && score < AI_REVIEW_HARD_REJECT_QUALITY_SCORE) {
    issues.push({
      imageId: image.id,
      code: 'LOW_QUALITY_SCORE',
      message: `Image quality score ${score} is too low for approval.`,
      severity: 'reject',
    });
  } else if (
    score != null &&
    score < AI_REVIEW_MIN_APPROVE_QUALITY_SCORE
  ) {
    issues.push({
      imageId: image.id,
      code: 'LOW_QUALITY_SCORE',
      message: `Image quality score ${score} is below the approval threshold.`,
      severity: 'propose',
    });
  }

  return issues;
}

export function assessAiReviewImageQuality(
  images: AiReviewImageQualityInput[]
): AiReviewImageQualityAssessment {
  const issues = images.flatMap(assessOneImage);
  const mustReject = issues.some((issue) => issue.severity === 'reject');
  const mustNotApprove = mustReject || issues.some((issue) => issue.severity === 'propose');
  return { mustReject, mustNotApprove, issues };
}

export function hasStoredValidationErrors(images: AiReviewImageQualityInput[]): boolean {
  return images.some((img) => extractCodes(img.validation_errors).length > 0);
}

export function buildImageQualityRejectReason(
  assessment: AiReviewImageQualityAssessment
): string {
  const headline = assessment.issues.some(
    (i) => i.code === VALIDATION_CODES.LOW_RESOLUTION
  )
    ? 'One or more photos are too low resolution (minimum 800800 pixels).'
    : assessment.issues.some(
          (i) => i.code === VALIDATION_CODES.CLUTTERED_BACKGROUND
        )
      ? 'One or more photos have a cluttered or distracting background.'
      : 'One or more photos do not meet marketplace quality standards.';
  const detail = assessment.issues
    .slice(0, 3)
    .map((i) => i.message)
    .join(' ');
  return `${headline} ${detail}`.trim();
}

export interface AiReviewQualityModelResult {
  decision: 'approve' | 'propose' | 'reject';
  reason: string;
  issues: Array<{ field: 'images'; code: string; message: string }>;
  proposedTitle: null;
  proposedDescription: null;
  imageActions: Array<{
    imageId: string;
    action: 'keep' | 'cleanup' | 'replace_required';
    note?: string;
  }>;
  rubric: { imagesOk: false };
}

export function buildQualityRejectModelResult(
  images: AiReviewImageQualityInput[],
  assessment: AiReviewImageQualityAssessment
): AiReviewQualityModelResult {
  return {
    decision: 'reject',
    reason: buildImageQualityRejectReason(assessment),
    issues: assessment.issues.map((issue) => ({
      field: 'images',
      code: issue.code,
      message: issue.message,
    })),
    proposedTitle: null,
    proposedDescription: null,
    imageActions: images.map((img) => {
      const issue = assessment.issues.find((i) => i.imageId === img.id);
      return {
        imageId: img.id,
        action:
          issue?.code === VALIDATION_CODES.CLUTTERED_BACKGROUND
            ? ('cleanup' as const)
            : ('replace_required' as const),
        note: issue?.message ?? 'Image quality below approval threshold',
      };
    }),
    rubric: { imagesOk: false },
  };
}

export function buildQualityProposeModelResult(
  images: AiReviewImageQualityInput[],
  assessment: AiReviewImageQualityAssessment
): AiReviewQualityModelResult {
  return {
    decision: 'propose',
    reason:
      'Photos need improvement before this listing can go live. Upload higher-quality images or use AI photo cleanup where recommended.',
    issues: assessment.issues.map((issue) => ({
      field: 'images',
      code: issue.code,
      message: issue.message,
    })),
    proposedTitle: null,
    proposedDescription: null,
    imageActions: images.map((img) => {
      const issue = assessment.issues.find((i) => i.imageId === img.id);
      return {
        imageId: img.id,
        action:
          issue?.code === VALIDATION_CODES.CLUTTERED_BACKGROUND
            ? ('cleanup' as const)
            : issue
              ? ('replace_required' as const)
              : ('keep' as const),
        note: issue?.message,
      };
    }),
    rubric: { imagesOk: false },
  };
}

export function clampDecisionForImageQuality<
  T extends { decision: 'approve' | 'propose' | 'reject' },
>(result: T, assessment: AiReviewImageQualityAssessment): T {
  if (result.decision !== 'approve' || !assessment.mustNotApprove) {
    return result;
  }
  return {
    ...result,
    decision: assessment.mustReject ? 'reject' : 'propose',
  };
}
