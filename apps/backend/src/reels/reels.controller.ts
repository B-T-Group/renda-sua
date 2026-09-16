import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  CreateReelDto,
  ListMerchantReelsQueryDto,
  ReelUploadDto,
  SetReelActiveDto,
  UpdateReelDto,
} from './dto/reels.dto';
import { ReelsService } from './reels.service';

@ApiTags('reels')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('reels')
export class ReelsController {
  constructor(
    private readonly reels: ReelsService,
    private readonly hasuraUser: HasuraUserService
  ) {}

  @Get('merchant')
  @ApiOperation({ summary: 'List reels owned by the current merchant' })
  @ApiResponse({ status: 200, description: 'Merchant reels returned' })
  list(
    @ReqContext() ctx: RequestContext,
    @Query() query: ListMerchantReelsQueryDto
  ) {
    return this.reels.listForMerchant(this.hasuraUser.getUserId(ctx), query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a merchant reel draft' })
  @ApiResponse({ status: 201, description: 'Reel draft created' })
  create(@ReqContext() ctx: RequestContext, @Body() dto: CreateReelDto) {
    return this.reels.create(this.hasuraUser.getUserId(ctx), dto);
  }

  @Patch(':reelId')
  @ApiOperation({ summary: 'Update a merchant reel draft' })
  @ApiResponse({ status: 200, description: 'Reel updated' })
  update(
    @ReqContext() ctx: RequestContext,
    @Param('reelId') reelId: string,
    @Body() dto: UpdateReelDto
  ) {
    return this.reels.update(this.hasuraUser.getUserId(ctx), reelId, dto);
  }

  @Patch(':reelId/active')
  @ApiOperation({ summary: 'Show or hide an approved reel on the public feed' })
  @ApiResponse({ status: 200, description: 'Reel visibility updated' })
  @ApiResponse({ status: 400, description: 'Reel is not live-capable' })
  setActive(
    @ReqContext() ctx: RequestContext,
    @Param('reelId') reelId: string,
    @Body() dto: SetReelActiveDto
  ) {
    return this.reels.setActive(this.hasuraUser.getUserId(ctx), reelId, dto);
  }

  @Delete(':reelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a merchant reel draft' })
  @ApiResponse({ status: 204, description: 'Reel deleted' })
  delete(@ReqContext() ctx: RequestContext, @Param('reelId') reelId: string) {
    return this.reels.delete(this.hasuraUser.getUserId(ctx), reelId);
  }

  @Post(':reelId/upload-url')
  @ApiOperation({ summary: 'Create a presigned reel video upload URL' })
  @ApiResponse({ status: 201, description: 'Presigned upload URL created' })
  upload(
    @ReqContext() ctx: RequestContext,
    @Param('reelId') reelId: string,
    @Body() dto: ReelUploadDto
  ) {
    return this.reels.createUpload(
      this.hasuraUser.getUserId(ctx),
      reelId,
      dto.fileName,
      dto.contentType
    );
  }

  @Post(':reelId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a reel for processing and moderation' })
  @ApiResponse({ status: 200, description: 'Reel submitted' })
  async submit(
    @ReqContext() ctx: RequestContext,
    @Param('reelId') reelId: string
  ) {
    await this.reels.submit(this.hasuraUser.getUserId(ctx), reelId);
    return { success: true };
  }

  @Post(':reelId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry processing for a failed merchant reel' })
  @ApiResponse({ status: 200, description: 'Reel requeued for processing' })
  @ApiResponse({ status: 400, description: 'Reel is not retryable' })
  retry(@ReqContext() ctx: RequestContext, @Param('reelId') reelId: string) {
    return this.reels.retryProcessing(this.hasuraUser.getUserId(ctx), reelId);
  }
}
