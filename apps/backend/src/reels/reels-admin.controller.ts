import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import {
  ReelAiReviewFeedbackDto,
  ReelAiReviewOverrideDto,
} from '../reel-ai-review/dto/reel-ai-review-admin.dto';
import { ReelAiReviewAdminService } from '../reel-ai-review/reel-ai-review-admin.service';
import { ModerateReelDto } from './dto/reels.dto';
import { ReelsService } from './reels.service';

interface AdminRequest extends Request {
  user: { id: string };
}

@ApiTags('admin-reels')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.MODERATE_ITEMS)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('admin/reels')
export class ReelsAdminController {
  constructor(
    private readonly reels: ReelsService,
    private readonly reelAiReviews: ReelAiReviewAdminService
  ) {}

  @Get('moderation')
  @ApiOperation({ summary: 'List reels awaiting moderation' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Moderation queue returned' })
  queue(@Query('limit') limit?: string) {
    return this.reels.moderationQueue(Number(limit) || 50);
  }

  @Patch(':reelId/moderation')
  @ApiOperation({ summary: 'Approve or reject a reel' })
  @ApiResponse({ status: 200, description: 'Moderation decision applied' })
  async moderate(
    @Param('reelId') reelId: string,
    @Body() dto: ModerateReelDto,
    @Req() request: AdminRequest
  ) {
    await this.reels.moderate(reelId, request.user.id, dto);
    return { success: true };
  }

  @Get('ai-reviews')
  @ApiOperation({ summary: 'List reel AI review decisions for audit' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'adminFeedback', required: false })
  @ApiQuery({ name: 'promptVersion', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listAiReviews(
    @Query('status') status?: string,
    @Query('adminFeedback') adminFeedback?: string,
    @Query('promptVersion') promptVersion?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.reelAiReviews.listReviews({
      status,
      adminFeedback,
      promptVersion,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('ai-reviews/:reviewId')
  @ApiOperation({ summary: 'Get a reel AI review by id' })
  getAiReview(@Param('reviewId') reviewId: string) {
    return this.reelAiReviews.getReview(reviewId);
  }

  @Post('ai-reviews/:reviewId/feedback')
  @ApiOperation({ summary: 'Submit admin feedback on a reel AI review' })
  feedbackAiReview(
    @Param('reviewId') reviewId: string,
    @Body() dto: ReelAiReviewFeedbackDto,
    @Req() request: AdminRequest
  ) {
    return this.reelAiReviews.submitFeedback(reviewId, request.user.id, dto);
  }

  @Post('ai-reviews/:reviewId/override')
  @ApiOperation({ summary: 'Override a reel AI review decision' })
  overrideAiReview(
    @Param('reviewId') reviewId: string,
    @Body() dto: ReelAiReviewOverrideDto,
    @Req() request: AdminRequest
  ) {
    return this.reelAiReviews.override(reviewId, request.user.id, dto);
  }
}
