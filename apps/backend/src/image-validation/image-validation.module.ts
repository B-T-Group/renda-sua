import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { AuthModule } from '../auth/auth.module';
import { ImageValidationController } from './image-validation.controller';
import { ImageValidationService } from './image-validation.service';
import { ItemActivationValidationService } from './item-activation-validation.service';
import { DuplicateImageDetectorService } from './services/duplicate-image-detector.service';
import { ImageLoaderService } from './services/image-loader.service';
import { ImageModerationService } from './services/image-moderation.service';
import { ImageQualityAnalyzerService } from './services/image-quality-analyzer.service';
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

@Module({
  imports: [ConfigModule, AuthModule, AiGenerationModule],
  controllers: [ImageValidationController],
  providers: [
    ImageValidationService,
    ImageLoaderService,
    ImageQualityAnalyzerService,
    ImageModerationService,
    DuplicateImageDetectorService,
    VisionAnalysisService,
    RekognitionModerationService,
    ResolutionValidator,
    BlurValidator,
    BrightnessValidator,
    ContentModerationValidator,
    ProductVisibilityValidator,
    BackgroundClutterValidator,
    TextDetectionValidator,
    DuplicateImageValidator,
    ItemActivationValidationService,
  ],
  exports: [
    ImageValidationService,
    DuplicateImageDetectorService,
    ItemActivationValidationService,
  ],
})
export class ImageValidationModule {}
