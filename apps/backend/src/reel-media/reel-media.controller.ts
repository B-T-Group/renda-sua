import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { ReelMediaService, type ReelMediaResult } from './reel-media.service';

@ApiTags('Reel media (internal)')
@Controller('internal/reels')
export class ReelMediaController {
  constructor(
    private readonly media: ReelMediaService,
    private readonly config: ConfigService<Configuration>
  ) {}

  @Public()
  @Post(':reelId/media-complete')
  @ApiOperation({ summary: 'Internal reel media processing callback' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiResponse({ status: 201, description: 'Processing result recorded' })
  async complete(
    @Param('reelId') reelId: string,
    @Body() body: ReelMediaResult,
    @Headers('x-rendasua-internal-key') key?: string
  ) {
    this.assertKey(key);
    await this.media.complete(reelId, body);
    return { success: true };
  }

  private assertKey(key?: string): void {
    const expected = this.config.get('notificationsInternal')?.apiKey;
    if (!expected || key !== expected) throw new UnauthorizedException();
  }
}
