import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { DuplicateImageDetectorService } from './services/duplicate-image-detector.service';
import { ImageLoaderService } from './services/image-loader.service';
import { RekognitionModerationService } from './services/rekognition-moderation.service';
import { VisionAnalysisService } from './services/vision-analysis.service';
import { BackgroundClutterValidator } from './validators/background-clutter.validator';
import { BlurValidator } from './validators/blur.validator';
import { BrightnessValidator } from './validators/brightness.validator';
import { ContentModerationValidator } from './validators/content-moderation.validator';
import { DuplicateImageValidator } from './validators/duplicate-image.validator';
import { ProductVisibilityValidator } from './validators/product-visibility.validator';
import { ResolutionValidator } from './validators/resolution.validator';
import { TextDetectionValidator } from './validators/text-detection.validator';
import type { ValidateImagesDto } from './dto/validate-images.dto';
import type {
  ImageValidationResult,
  ImageValidator,
  ValidateImagesResponse,
  ValidationContext,
  ValidatedImage,
} from './types/image-validation.types';
import {
  aggregateScore,
  calculateScore,
} from './utils/score-calculator.util';

const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class ImageValidationService {
  private readonly logger = new Logger(ImageValidationService.name);
  private readonly validators: ImageValidator[];

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly imageLoader: ImageLoaderService,
    private readonly duplicateDetector: DuplicateImageDetectorService,
    private readonly visionAnalysis: VisionAnalysisService,
    private readonly rekognitionModeration: RekognitionModerationService,
    private readonly duplicateValidator: DuplicateImageValidator,
    resolutionValidator: ResolutionValidator,
    blurValidator: BlurValidator,
    brightnessValidator: BrightnessValidator,
    contentModerationValidator: ContentModerationValidator,
    productVisibilityValidator: ProductVisibilityValidator,
    backgroundClutterValidator: BackgroundClutterValidator,
    textDetectionValidator: TextDetectionValidator
  ) {
    this.validators = [
      resolutionValidator,
      blurValidator,
      brightnessValidator,
      contentModerationValidator,
      productVisibilityValidator,
      backgroundClutterValidator,
      textDetectionValidator,
      duplicateValidator,
    ];
  }

  async validateImages(
    businessId: string,
    dto: ValidateImagesDto
  ): Promise<ValidateImagesResponse> {
    const cfg = this.configService.get('imageValidation', { infer: true });

    if (!(cfg?.enabled ?? false)) {
      return this.buildDisabledResponse(dto);
    }

    const timeoutMs = cfg?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const flags = {
      enableVision: cfg?.enableVision ?? false,
      requireVision: cfg?.requireVision ?? false,
      moderationProvider: cfg?.moderationProvider ?? 'none',
    };

    const loaded = await Promise.all(
      dto.images.map((img, i) =>
        this.imageLoader.loadFromBase64(
          img.data,
          img.mimeType,
          img.fileName,
          i
        )
      )
    );

    const existingPhashes = await this.duplicateDetector.loadExistingPhashes(
      businessId,
      dto.itemId,
      dto.rentalItemId
    );

    this.duplicateValidator.clearBatch();

    const moderationResults =
      flags.moderationProvider === 'rekognition'
        ? await this.rekognitionModeration.analyzeBatch(loaded)
        : [];

    let visionResults: ValidationContext['visionResults'] = [];
    let visionSkipped = !flags.enableVision;

    if (flags.enableVision) {
      const visionBudget = Math.max(500, timeoutMs - 1500);
      const includeModeration = flags.moderationProvider === 'openai';
      visionResults = await Promise.race([
        this.visionAnalysis.analyzeBatch(loaded, visionBudget, {
          includeModeration,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('vision_timeout')), visionBudget)
        ),
      ]).catch(() => {
        this.logger.warn('Vision analysis skipped due to timeout or error');
        visionSkipped = true;
        return [];
      });
    }

    if (flags.requireVision && flags.enableVision && visionSkipped) {
      throw new HttpException(
        {
          success: false,
          error: 'VISION_UNAVAILABLE',
          message: 'Image quality vision checks are temporarily unavailable.',
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    const ctx: ValidationContext = {
      businessId,
      itemId: dto.itemId,
      rentalItemId: dto.rentalItemId,
      existingPhashes,
      flags,
      visionResults,
      moderationResults,
    };

    const results = await Promise.all(
      loaded.map((image) => this.validateOne(image, ctx))
    );

    const allErrors = results.flatMap((r) => r.errors);
    const allWarnings = results.flatMap((r) => r.warnings);

    return {
      passed: allErrors.length === 0,
      score: aggregateScore(results),
      results,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  private buildDisabledResponse(
    dto: ValidateImagesDto
  ): ValidateImagesResponse {
    return {
      passed: true,
      score: 100,
      results: dto.images.map((img, i) => ({
        passed: true,
        score: 100,
        errors: [],
        warnings: [],
        fileName: img.fileName,
        clientIndex: i,
      })),
      errors: [],
      warnings: [],
    };
  }

  private async validateOne(
    image: ValidatedImage,
    ctx: ValidationContext
  ): Promise<ImageValidationResult> {
    const issueSets = await Promise.all(
      this.validators.map((v) => v.validate(image, ctx))
    );
    const allIssues = issueSets.flat();
    const errors = allIssues.filter((i) => i.severity === 'error');
    const warnings = allIssues.filter((i) => i.severity === 'warning');
    const perceptualHash = await this.duplicateDetector.computeHash(image);

    return {
      passed: errors.length === 0,
      score: calculateScore(allIssues),
      errors,
      warnings,
      fileName: image.fileName,
      clientIndex: image.clientIndex,
      perceptualHash,
    };
  }
}
