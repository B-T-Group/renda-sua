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
import { ReelAiReviewService } from './reel-ai-review.service';

@ApiTags('Reel AI review (internal)')
@Controller('internal/reels')
export class ReelAiReviewInternalController {
  constructor(
    private readonly review: ReelAiReviewService,
    private readonly config: ConfigService<Configuration>
  ) {}

  @Public()
  @Post(':reelId/ai-review')
  @ApiOperation({ summary: 'Internal: run automated reel review' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { reviewVersion: { type: 'integer', default: 1 } },
    },
  })
  @ApiResponse({ status: 201, description: 'Review attempt completed' })
  run(
    @Param('reelId') reelId: string,
    @Body() body: { reviewVersion?: number },
    @Headers('x-rendasua-internal-key') key?: string
  ) {
    this.assertKey(key);
    return this.review.runReview(reelId, body.reviewVersion || 1);
  }

  private assertKey(key?: string): void {
    const expected = this.config.get('notificationsInternal')?.apiKey;
    if (!expected || key !== expected) throw new UnauthorizedException();
  }
}
