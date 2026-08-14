import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
    summary:
      'Request async cleanup for item images. selections[].kind rembg|ai; bare imageIds default to ai (1 token each).',
  })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiBody({ type: RequestAiImageCleanupDto })
  @ApiResponse({ status: 201, description: 'Cleanup job queued' })
  @ApiResponse({ status: 402, description: 'Insufficient AI tokens' })
  @ApiResponse({
    status: 409,
    description: 'Open rembg/ai result already exists for an image',
  })
  async requestCleanup(
    @Param('itemId') itemId: string,
    @Body() body: RequestAiImageCleanupDto
  ) {
    const data = await this.cleanupService.requestCleanup(
      itemId,
      body?.imageIds,
      'creation',
      body?.selections
    );
    return { success: true, data };
  }

  @Get('items/:itemId/ai-image-cleanup/open')
  @ApiOperation({
    summary:
      'Check whether an AI cleanup job is already queued/processing/ready for this item',
  })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Open-job status' })
  async getOpenJob(@Param('itemId') itemId: string) {
    const data = await this.cleanupService.getOpenJobForItem(itemId);
    return { success: true, data };
  }

  @Get('ai-image-cleanup/pending')
  @ApiOperation({
    summary:
      'List AI cleanup jobs that need merchant review (low-confidence / review_all)',
  })
  @ApiResponse({ status: 200, description: 'Pending jobs' })
  async listPending() {
    const data = await this.cleanupService.listPending();
    return { success: true, data };
  }

  @Get('ai-image-cleanup/activity')
  @ApiOperation({
    summary: 'Recent auto-applied enhancements (for toast hydration)',
  })
  async listActivity() {
    const data = await this.cleanupService.listActivity();
    return { success: true, data };
  }

  @Get('ai-image-cleanup/preference')
  @ApiOperation({ summary: 'Get auto-enhance preference and token balance' })
  async getPreference() {
    const data = await this.cleanupService.getAutoEnhancePreference();
    return { success: true, data };
  }

  @Patch('ai-image-cleanup/preference')
  @ApiOperation({ summary: 'Set auto-enhance preference' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { auto_enhance_enabled: { type: 'boolean' } },
      required: ['auto_enhance_enabled'],
    },
  })
  async setPreference(
    @Body() body: { auto_enhance_enabled: boolean }
  ) {
    const data = await this.cleanupService.setAutoEnhancePreference(
      !!body.auto_enhance_enabled
    );
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
  @ApiOperation({
    summary: 'Accept cleaned image (pointer-flip to enhanced, keep original)',
  })
  @ApiParam({ name: 'resultId', format: 'uuid' })
  async accept(@Param('resultId') resultId: string) {
    return this.cleanupService.acceptResult(resultId);
  }

  @Post('ai-image-cleanup/results/:resultId/revert')
  @ApiOperation({ summary: 'Revert to original after an accepted enhancement' })
  @ApiParam({ name: 'resultId', format: 'uuid' })
  async revert(@Param('resultId') resultId: string) {
    return this.cleanupService.revertResult(resultId);
  }

  @Post('ai-image-cleanup/results/:resultId/reapply')
  @ApiOperation({ summary: 'Re-apply enhanced version after a revert' })
  @ApiParam({ name: 'resultId', format: 'uuid' })
  async reapply(@Param('resultId') resultId: string) {
    return this.cleanupService.reapplyResult(resultId);
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
  @ApiOperation({
    summary: 'Retry AI cleanup for a rejected/failed result (1 token)',
  })
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
