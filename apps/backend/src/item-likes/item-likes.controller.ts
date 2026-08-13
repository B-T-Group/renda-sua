import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { SetItemLikeDto } from './dto/set-item-like.dto';
import { ItemLikesService } from './item-likes.service';

@ApiTags('item-likes')
@Controller('item-likes')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ItemLikesController {
  constructor(
    private readonly itemLikesService: ItemLikesService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Put(':itemId')
  @ApiOperation({ summary: 'Like or unlike a catalog item' })
  @ApiParam({ name: 'itemId', description: 'Catalog item UUID (items.id)' })
  @ApiBody({ type: SetItemLikeDto })
  @ApiResponse({ status: 200, description: 'Like state updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async setLike(
    @Param('itemId') itemId: string,
    @Body() body: SetItemLikeDto,
    @ReqContext() ctx: RequestContext
  ) {
    const userId = this.requireUserId(ctx);
    try {
      const result = await this.itemLikesService.setLike(
        userId,
        itemId,
        body.liked
      );
      return {
        success: true,
        data: result,
        message: body.liked ? 'Item liked' : 'Item unliked',
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: error?.message || 'Failed to update like',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List current user liked catalog items' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Liked items returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listLikes(
    @ReqContext() ctx: RequestContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const userId = this.requireUserId(ctx);
    try {
      const data = await this.itemLikesService.getUserLikes(
        userId,
        page ? Number(page) : 1,
        limit ? Number(limit) : 20
      );
      return {
        success: true,
        data,
        message: 'Liked items retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: error?.message || 'Failed to list likes',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private requireUserId(ctx: RequestContext): string {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException();
    }
    return userId;
  }
}
