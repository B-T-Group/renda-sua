import { Injectable } from '@nestjs/common';
import {
  BRIGHTNESS_DARK,
  BRIGHTNESS_OVEREXPOSED,
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
export class BrightnessValidator implements ImageValidator {
  readonly name = 'brightness';

  constructor(private readonly qualityAnalyzer: ImageQualityAnalyzerService) {}

  async validate(
    image: ValidatedImage,
    _ctx: ValidationContext
  ): Promise<ValidationIssue[]> {
    const metrics = await this.qualityAnalyzer.analyze(image);
    if (
      metrics.meanBrightness >= BRIGHTNESS_DARK &&
      metrics.meanBrightness <= BRIGHTNESS_OVEREXPOSED
    ) {
      return [];
    }
    return [
      {
        code: VALIDATION_CODES.POOR_LIGHTING,
        message: validationMessage(VALIDATION_CODES.POOR_LIGHTING),
        severity: 'warning',
      },
    ];
  }
}
