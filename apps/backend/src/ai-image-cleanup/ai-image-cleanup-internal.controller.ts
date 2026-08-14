import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { AiImageCleanupService } from './ai-image-cleanup.service';

@ApiTags('AI image cleanup (internal)')
@Controller('internal/ai-image-cleanup')
export class AiImageCleanupInternalController {
  constructor(
    private readonly cleanupService: AiImageCleanupService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post('jobs/:jobId/process')
  @ApiOperation({ summary: 'Internal: process an async AI image cleanup job' })
  @ApiParam({ name: 'jobId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Job processed' })
  @ApiResponse({ status: 401, description: 'Invalid internal key' })
  async process(
    @Param('jobId') jobId: string,
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    return this.cleanupService.processJob(jobId);
  }

  @Public()
  @Post('jobs/:jobId/fail')
  @ApiOperation({
    summary: 'Internal: mark cleanup job failed after SQS retries exhausted',
  })
  @ApiParam({ name: 'jobId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Job marked failed' })
  @ApiResponse({ status: 401, description: 'Invalid internal key' })
  @ApiResponse({ status: 409, description: 'Job still processing' })
  async fail(
    @Param('jobId') jobId: string,
    @Body() body: { timestamp?: string },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    return this.cleanupService.failJobAfterQueueExhaustion(
      jobId,
      body?.timestamp
    );
  }

  private assertInternalKey(internalKey?: string): void {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
  }
}
