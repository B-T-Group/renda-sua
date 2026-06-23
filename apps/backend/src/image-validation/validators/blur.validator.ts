import { Injectable } from '@nestjs/common';
import {
  BLUR_VARIANCE_THRESHOLD,
  ImageQualityAnalyzerService,
} from '../services/image-quality-analyzer.service';
import type {
  ImageValidator,
  ValidationContext,
  ValidationIssue,
  ValidatedImage,
} from '../types/image-validation.types';
import { VALIDATION_CODES } from '../types/image-validation.types';
import { validationMessage } from '../utils/validation-messages.util';

@Injectable()
export class BlurValidator implements ImageValidator {
  readonly name = 'blur';

  constructor(private readonly qualityAnalyzer: ImageQualityAnalyzerService) {}

  async validate(
    image: ValidatedImage,
    _ctx: ValidationContext
  ): Promise<ValidationIssue[]> {
    const metrics = await this.qualityAnalyzer.analyze(image);
    if (metrics.blurVariance >= BLUR_VARIANCE_THRESHOLD) return [];
    return [
      {
        code: VALIDATION_CODES.IMAGE_BLURRY,
        message: validationMessage(VALIDATION_CODES.IMAGE_BLURRY),
        severity: 'warning',
      },
    ];
  }
}
