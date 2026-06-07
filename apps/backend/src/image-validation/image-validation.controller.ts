import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiService } from '../ai/ai.service';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CleanupPreviewDto } from './dto/cleanup-preview.dto';
import { ValidateImagesDto } from './dto/validate-images.dto';
import { ImageValidationService } from './image-validation.service';

@ApiTags('images')
@Controller('images')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ImageValidationController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly imageValidationService: ImageValidationService,
    private readonly aiService: AiService
  ) {}

  @Post('validate')
  @ApiOperation({
    summary: 'Validate product images before upload',
    description:
      'Runs resolution, blur, moderation, lighting, and duplicate checks. Returns errors (blocking) and warnings.',
  })
  @ApiBody({ type: ValidateImagesDto })
  @ApiResponse({
    status: 200,
    description: 'Validation completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            passed: { type: 'boolean' },
            score: { type: 'number' },
            errors: { type: 'array' },
            warnings: { type: 'array' },
            results: { type: 'array' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async validate(@Body() dto: ValidateImagesDto) {
    const businessId = await this.getBusinessIdOrThrow();
    const data = await this.imageValidationService.validateImages(
      businessId,
      dto
    );
    return { success: true, data };
  }

  @Post('cleanup-preview')
  @ApiOperation({
    summary: 'AI cleanup preview before S3 upload',
    description:
      'Returns a cleaned image preview as base64. Requires image_cleanup_enabled on the business.',
  })
  @ApiBody({ type: CleanupPreviewDto })
  @ApiResponse({ status: 200, description: 'Cleanup preview generated' })
  @ApiResponse({ status: 403, description: 'AI cleanup not enabled' })
  async cleanupPreview(@Body() dto: CleanupPreviewDto) {
    await this.assertCleanupEnabled();
    const result = await this.aiService.cleanupProductImage({
      imageUrl: dto.imageUrl,
      imageBase64: dto.imageBase64,
      mimeType: dto.mimeType,
      issues: dto.issues,
    });
    return { success: true, data: result };
  }

  private async assertCleanupEnabled(): Promise<void> {
    const user = await this.hasuraUserService.getUser();
    if (!user?.business?.image_cleanup_enabled) {
      throw new HttpException(
        { success: false, error: 'AI image cleanup is not enabled' },
        HttpStatus.FORBIDDEN
      );
    }
  }

  private async getBusinessIdOrThrow(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    return businessId;
  }
}
