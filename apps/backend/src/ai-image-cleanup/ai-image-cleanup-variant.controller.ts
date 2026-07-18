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
      'Request async AI cleanup for variant images (consumes 1 token each)',
  })
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiBody({ type: RequestAiImageCleanupDto })
  @ApiResponse({ status: 201, description: 'Cleanup job queued' })
  @ApiResponse({ status: 402, description: 'Insufficient AI tokens' })
  @ApiResponse({ status: 409, description: 'Job already open for variant' })
  async requestVariantCleanup(
    @Param('variantId') variantId: string,
    @Body() body: RequestAiImageCleanupDto
  ) {
    const data = await this.cleanupService.requestVariantCleanup(
      variantId,
      body?.imageIds
    );
    return { success: true, data };
  }
}
