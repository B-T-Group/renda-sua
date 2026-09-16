import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ReelCommentsService } from './reel-comments.service';

class CreateReelCommentDto {
  body!: string;
}

@ApiTags('reel-comments')
@Controller('reels/:reelId/comments')
export class ReelCommentsController {
  constructor(
    private readonly comments: ReelCommentsService,
    private readonly hasuraUser: HasuraUserService
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List visible comments on a reel' })
  async list(@Param('reelId') reelId: string) {
    const rows = await this.comments.list(reelId);
    return { success: true, data: rows };
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a comment on a reel' })
  async create(
    @ReqContext() ctx: RequestContext,
    @Param('reelId') reelId: string,
    @Body() dto: CreateReelCommentDto
  ) {
    const userId = this.hasuraUser.getUserId(ctx);
    const row = await this.comments.create(userId, reelId, dto.body);
    return { success: true, data: row };
  }

  @Patch(':commentId/hide')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merchant hides a comment on their reel' })
  async hide(
    @ReqContext() ctx: RequestContext,
    @Param('commentId') commentId: string
  ) {
    const userId = this.hasuraUser.getUserId(ctx);
    await this.comments.hideForMerchant(userId, commentId);
    return { success: true };
  }
}
