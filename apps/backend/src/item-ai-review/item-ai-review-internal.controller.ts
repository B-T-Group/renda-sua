import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
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
  @ApiResponse({
    status: 503,
    description: 'Deferred — cleanup still processing; SQS should retry',
  })
  async runAiReview(
    @Param('itemId') itemId: string,
    @Body() body: { reviewVersion?: number },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    this.assertInternalKey(internalKey);
    const result = await this.reviewService.runReview(itemId, body?.reviewVersion);
    if (result.retryLater) {
      throw new HttpException(
        'AI review deferred; cleanup still processing',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    return result;
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
