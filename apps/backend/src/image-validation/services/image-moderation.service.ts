import { Injectable } from '@nestjs/common';
import type {
  ImageModerationResult,
  ValidationIssue,
  ValidatedImage,
  VisionImageAnalysis,
} from '../types/image-validation.types';
import { VALIDATION_CODES } from '../types/image-validation.types';
import { validationMessage } from '../utils/validation-messages.util';

@Injectable()
export class ImageModerationService {
  getModerationForImage(
    image: ValidatedImage,
    results: ImageModerationResult[]
  ): ImageModerationResult | undefined {
    return results.find((r) => r.clientIndex === image.clientIndex);
  }

  buildModerationIssue(
    vision: VisionImageAnalysis | undefined,
    moderation?: ImageModerationResult
  ): ValidationIssue[] {
    if (moderation && !moderation.safe) {
      return [
        {
          code: VALIDATION_CODES.INAPPROPRIATE_CONTENT,
          message: validationMessage(VALIDATION_CODES.INAPPROPRIATE_CONTENT),
          severity: 'error',
        },
      ];
    }
    if (!vision || vision.safe) return [];
    return [
      {
        code: VALIDATION_CODES.INAPPROPRIATE_CONTENT,
        message: validationMessage(VALIDATION_CODES.INAPPROPRIATE_CONTENT),
        severity: 'error',
      },
    ];
  }

  buildVisionWarningIssues(
    vision: VisionImageAnalysis | undefined
  ): ValidationIssue[] {
    if (!vision) return [];
    const issues: ValidationIssue[] = [];
    if (vision.productFillPercent < 50) {
      issues.push({
        code: VALIDATION_CODES.PRODUCT_TOO_SMALL,
        message: validationMessage(VALIDATION_CODES.PRODUCT_TOO_SMALL),
        severity: 'warning',
      });
    }
    if (vision.backgroundClutter === 'high') {
      issues.push({
        code: VALIDATION_CODES.CLUTTERED_BACKGROUND,
        message: validationMessage(VALIDATION_CODES.CLUTTERED_BACKGROUND),
        severity: 'warning',
      });
    }
    if (vision.promotionalTextLevel === 'high') {
      issues.push({
        code: VALIDATION_CODES.TOO_MUCH_TEXT,
        message: validationMessage(VALIDATION_CODES.TOO_MUCH_TEXT),
        severity: 'warning',
      });
    }
    return issues;
  }

  getVisionForImage(
    image: ValidatedImage,
    results: VisionImageAnalysis[]
  ): VisionImageAnalysis | undefined {
    return results.find((r) => r.clientIndex === image.clientIndex);
  }
}
