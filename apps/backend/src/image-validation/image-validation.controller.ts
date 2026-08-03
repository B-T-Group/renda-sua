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
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
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
    private readonly imageValidationService: ImageValidationService
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
    summary: 'Deprecated — use async AI image cleanup jobs instead',
    deprecated: true,
  })
  @ApiResponse({ status: 410, description: 'Endpoint removed' })
  async cleanupPreview() {
    throw new HttpException(
      {
        success: false,
        error:
          'cleanup-preview has been removed. Upload the image, then request async AI cleanup.',
        code: 'CLEANUP_PREVIEW_REMOVED',
      },
      HttpStatus.GONE
    );
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
