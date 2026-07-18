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
import { BusinessTokensService } from '../business-tokens/business-tokens.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CleanupPreviewDto } from './dto/cleanup-preview.dto';
import { ValidateImagesDto } from './dto/validate-images.dto';
import { ImageValidationService } from './image-validation.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';

@ApiTags('images')
@Controller('images')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ImageValidationController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly imageValidationService: ImageValidationService,
    private readonly aiService: AiService,
    private readonly businessTokensService: BusinessTokensService
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
  async validate(@ReqContext() ctx: RequestContext, @Body() dto: ValidateImagesDto) {
    const businessId = await this.getBusinessIdOrThrow(ctx);
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
      'Returns a cleaned image preview as base64. Consumes 1 AI token per request.',
  })
  @ApiBody({ type: CleanupPreviewDto })
  @ApiResponse({ status: 200, description: 'Cleanup preview generated' })
  @ApiResponse({ status: 402, description: 'Insufficient AI tokens' })
  async cleanupPreview(@ReqContext() ctx: RequestContext, @Body() dto: CleanupPreviewDto) {
    const user = await this.hasuraUserService.getUser(ctx);
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const { result, balanceAfter } =
      await this.businessTokensService.runCleanupWithToken(
        {
          businessId,
          userId: user.id,
          subjectType: 'preview',
          subjectId: null,
          imageUrl: dto.imageUrl ?? null,
        },
        () =>
          this.aiService.cleanupProductImage({
            imageUrl: dto.imageUrl,
            imageBase64: dto.imageBase64,
            mimeType: dto.mimeType,
            issues: dto.issues,
          })
      );
    return {
      success: true,
      data: result,
      ai_tokens_remaining: balanceAfter,
    };
  }

  private async getBusinessIdOrThrow(ctx: RequestContext): Promise<string> {
    const user = await this.hasuraUserService.getUser(ctx);
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
