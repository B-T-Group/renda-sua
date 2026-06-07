import { Injectable } from '@nestjs/common';
import { MIN_HEIGHT, MIN_WIDTH } from '../services/image-quality-analyzer.service';
import type {
  ImageValidator,
  ValidationContext,
  ValidationIssue,
  ValidatedImage,
} from '../types/image-validation.types';
import { VALIDATION_CODES } from '../types/image-validation.types';
import { validationMessage } from '../utils/validation-messages.util';

@Injectable()
export class ResolutionValidator implements ImageValidator {
  readonly name = 'resolution';

  async validate(
    image: ValidatedImage,
    _ctx: ValidationContext
  ): Promise<ValidationIssue[]> {
    if (image.width >= MIN_WIDTH && image.height >= MIN_HEIGHT) return [];
    return [
      {
        code: VALIDATION_CODES.LOW_RESOLUTION,
        message: validationMessage(VALIDATION_CODES.LOW_RESOLUTION),
        severity: 'error',
      },
    ];
  }
}
