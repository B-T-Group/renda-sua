import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { AdminBroadcastService } from './admin-broadcast.service';

@ApiTags('Notifications')
@Controller('notifications')
export class AdminBroadcastInternalController {
  constructor(
    private readonly broadcastService: AdminBroadcastService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post('internal/admin-broadcast')
  @ApiOperation({
    summary: 'Internal: process an admin broadcast campaign (SQS Lambda)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['campaignId'],
      properties: {
        campaignId: { type: 'string', format: 'uuid' },
        afterUserId: { type: 'string', format: 'uuid', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Processing finished or skipped' })
  @ApiResponse({ status: 400, description: 'Missing campaignId' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  @ApiResponse({ status: 500, description: 'Processing failed — SQS should retry' })
  async process(
    @Body() body: { campaignId?: string; afterUserId?: string | null },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{ success: boolean; skipped?: boolean }> {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
    const campaignId = body?.campaignId?.trim();
    if (!campaignId) {
      throw new BadRequestException('campaignId is required');
    }
    const afterUserId = body?.afterUserId?.trim() || null;
    try {
      await this.broadcastService.processCampaign(campaignId, afterUserId);
      return { success: true };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        { success: false, error: message },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
