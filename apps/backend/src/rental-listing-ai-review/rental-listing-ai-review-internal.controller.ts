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
import { RentalListingAiReviewService } from './rental-listing-ai-review.service';

@ApiTags('Rental listing AI review (internal)')
@Controller('internal/rental-listings')
export class RentalListingAiReviewInternalController {
  constructor(
    private readonly reviewService: RentalListingAiReviewService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post(':listingId/ai-review')
  @ApiOperation({
    summary: 'Internal: run AI auto-review for a rental listing (Lambda)',
  })
  @ApiParam({ name: 'listingId', format: 'uuid' })
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
    @Param('listingId') listingId: string,
    @Body() body: { reviewVersion?: number },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    this.assertInternalKey(internalKey);
    const result = await this.reviewService.runReview(
      listingId,
      body?.reviewVersion
    );
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
