import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
@Controller('business-items')
export class AiImageCleanupController {
  constructor(private readonly cleanupService: AiImageCleanupService) {}

  @Post('items/:itemId/ai-image-cleanup')
  @ApiOperation({
    summary: 'Request async AI cleanup for item images (consumes 1 token each)',
  })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiBody({ type: RequestAiImageCleanupDto })
  @ApiResponse({ status: 201, description: 'Cleanup job queued' })
  @ApiResponse({ status: 402, description: 'Insufficient AI tokens' })
  @ApiResponse({ status: 409, description: 'Job already open for item' })
  async requestCleanup(
    @Param('itemId') itemId: string,
    @Body() body: RequestAiImageCleanupDto
  ) {
    const data = await this.cleanupService.requestCleanup(
      itemId,
      body?.imageIds
    );
    return { success: true, data };
  }

  @Get('ai-image-cleanup/pending')
  @ApiOperation({ summary: 'List AI cleanup jobs ready for merchant review' })
  @ApiResponse({ status: 200, description: 'Pending jobs' })
  async listPending() {
    const data = await this.cleanupService.listPending();
    return { success: true, data };
  }

  @Get('ai-image-cleanup/jobs/:jobId')
  @ApiOperation({ summary: 'Get AI cleanup job with before/after results' })
  @ApiParam({ name: 'jobId', format: 'uuid' })
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.cleanupService.getJob(jobId);
    return { success: true, data: { job } };
  }

  @Post('ai-image-cleanup/results/:resultId/accept')
  @ApiOperation({ summary: 'Accept cleaned image and replace the live URL' })
  @ApiParam({ name: 'resultId', format: 'uuid' })
  async accept(@Param('resultId') resultId: string) {
    return this.cleanupService.acceptResult(resultId);
  }

  @Post('ai-image-cleanup/results/:resultId/reject')
  @ApiOperation({
    summary:
      'Reject a ready cleaned image (keep original), or dismiss a failed result from review',
  })
  @ApiParam({ name: 'resultId', format: 'uuid' })
  async reject(@Param('resultId') resultId: string) {
    return this.cleanupService.rejectResult(resultId);
  }

  @Post('ai-image-cleanup/results/:resultId/retry')
  @ApiOperation({ summary: 'Retry AI cleanup for a rejected/failed result (1 token)' })
  @ApiParam({ name: 'resultId', format: 'uuid' })
  async retry(@Param('resultId') resultId: string) {
    const data = await this.cleanupService.retryResult(resultId);
    return { success: true, data };
  }

  @Post('ai-image-cleanup/jobs/:jobId/cancel')
  @ApiOperation({
    summary:
      'Cancel a ready/failed cleanup job: keep originals and leave without applying',
  })
  @ApiParam({ name: 'jobId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Job cancelled' })
  @ApiResponse({ status: 400, description: 'Job cannot be cancelled' })
  async cancel(@Param('jobId') jobId: string) {
    return this.cleanupService.cancelJob(jobId);
  }
}
