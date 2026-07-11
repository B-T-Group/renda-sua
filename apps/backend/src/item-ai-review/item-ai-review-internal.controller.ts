import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { ItemAiReviewService } from './item-ai-review.service';

@ApiTags('Item AI review (internal)')
@Controller('internal/items')
export class ItemAiReviewInternalController {
  constructor(
    private readonly reviewService: ItemAiReviewService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post(':itemId/ai-review')
  @ApiOperation({
    summary: 'Internal: run AI auto-review for a sale item (Lambda)',
  })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reviewVersion: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Review attempt finished' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async runAiReview(
    @Param('itemId') itemId: string,
    @Body() body: { reviewVersion?: number },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    this.assertInternalKey(internalKey);
    return this.reviewService.runReview(itemId, body?.reviewVersion);
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
