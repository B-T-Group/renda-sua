import { Injectable } from '@nestjs/common';
import { ImageModerationService } from '../services/image-moderation.service';
import type {
  ImageValidator,
  ValidationContext,
  ValidationIssue,
  ValidatedImage,
} from '../types/image-validation.types';

@Injectable()
export class ContentModerationValidator implements ImageValidator {
  readonly name = 'content-moderation';

  constructor(private readonly moderationService: ImageModerationService) {}

  async validate(
    image: ValidatedImage,
    ctx: ValidationContext
  ): Promise<ValidationIssue[]> {
    const provider = ctx.flags.moderationProvider;
    if (provider === 'none') return [];

    const moderation =
      provider === 'rekognition'
        ? this.moderationService.getModerationForImage(
            image,
            ctx.moderationResults ?? []
          )
        : undefined;
    const vision =
      provider === 'openai'
        ? this.moderationService.getVisionForImage(
            image,
            ctx.visionResults ?? []
          )
        : undefined;

    return this.moderationService.buildModerationIssue(vision, moderation);
  }
}
