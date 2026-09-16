import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { ReelsFeedService } from './reels-feed.service';

@ApiTags('reels')
@Controller('reels')
@Throttle({ short: { limit: 120, ttl: 60000 } })
export class ReelsFeedController {
  constructor(private readonly feed: ReelsFeedService) {}

  @Public()
  @Get('feed')
  @ApiOperation({ summary: 'Public reels feed (cursor pagination)' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sessionId', required: false })
  @ApiResponse({ status: 200, description: 'Feed items returned' })
  async getFeed(
    @ReqContext() ctx: RequestContext,
    @Query('country') country?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('sessionId') sessionId?: string
  ) {
    const data = await this.feed.getFeed({
      ctx,
      country,
      cursor,
      limit: limit ? Number(limit) : undefined,
      sessionId,
    });
    return { success: true, data, message: 'Reels feed retrieved' };
  }

  @Public()
  @Post(':reelId/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a reel view (3s+ watch time)' })
  async recordView(
    @Param('reelId') reelId: string,
    @Body() body: { watchTimeMs?: number; sessionId?: string },
    @ReqContext() ctx: RequestContext
  ) {
    const userId =
      ctx.userId && ctx.userId !== 'anonymous' ? ctx.userId : undefined;
    await this.feed.recordView({
      reelId,
      userId,
      sessionId: body.sessionId,
      watchTimeMs: body.watchTimeMs ?? 0,
    });
  }

  @Post(':reelId/like')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like or unlike a reel' })
  async setLike(
    @Param('reelId') reelId: string,
    @Body() body: { liked: boolean },
    @ReqContext() ctx: RequestContext
  ) {
    const userId = ctx.userId;
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException();
    }
    await this.feed.setLike(userId, reelId, body.liked);
    return { success: true, message: body.liked ? 'Liked' : 'Unliked' };
  }
}
