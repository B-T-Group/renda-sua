import { Injectable } from '@nestjs/common';
import { ImageModerationService } from '../services/image-moderation.service';
import type {
  ImageValidator,
  ValidationContext,
  ValidationIssue,
  ValidatedImage,
} from '../types/image-validation.types';
import { VALIDATION_CODES } from '../types/image-validation.types';

@Injectable()
export class BackgroundClutterValidator implements ImageValidator {
  readonly name = 'background-clutter';

  constructor(private readonly moderationService: ImageModerationService) {}

  async validate(
    image: ValidatedImage,
    ctx: ValidationContext
  ): Promise<ValidationIssue[]> {
    if (!ctx.flags.enableVision) return [];
    const vision = this.moderationService.getVisionForImage(
      image,
      ctx.visionResults ?? []
    );
    return this.moderationService
      .buildVisionWarningIssues(vision)
      .filter((i) => i.code === VALIDATION_CODES.CLUTTERED_BACKGROUND);
  }
}
