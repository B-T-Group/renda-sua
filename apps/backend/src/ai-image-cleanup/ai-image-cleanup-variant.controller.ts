import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiImageCleanupService } from './ai-image-cleanup.service';
import { RequestAiImageCleanupDto } from './dto/request-ai-image-cleanup.dto';

@ApiTags('ai-image-cleanup')
@ApiBearerAuth()
@Controller('item-variants')
export class AiImageCleanupVariantController {
  constructor(private readonly cleanupService: AiImageCleanupService) {}

  @Post(':variantId/ai-image-cleanup')
  @ApiOperation({
    summary:
      'Request async cleanup for variant images. selections[].kind rembg|ai; bare imageIds default to ai.',
  })
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiBody({ type: RequestAiImageCleanupDto })
  @ApiResponse({ status: 201, description: 'Cleanup job queued' })
  @ApiResponse({ status: 402, description: 'Insufficient AI tokens' })
  @ApiResponse({
    status: 409,
    description: 'Open rembg/ai result already exists for an image',
  })
  async requestVariantCleanup(
    @Param('variantId') variantId: string,
    @Body() body: RequestAiImageCleanupDto
  ) {
    const data = await this.cleanupService.requestVariantCleanup(
      variantId,
      body?.imageIds,
      body?.selections
    );
    return { success: true, data };
  }
}
