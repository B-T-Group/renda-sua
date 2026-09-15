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
import { SetBusinessFollowDto } from './dto/set-business-follow.dto';
import { BusinessFollowsService } from './business-follows.service';

@ApiTags('business-follows')
@Controller('business-follows')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BusinessFollowsController {
  constructor(
    private readonly businessFollowsService: BusinessFollowsService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Put(':businessId')
  @ApiOperation({ summary: 'Follow or unfollow a business' })
  @ApiParam({ name: 'businessId', description: 'Business UUID (businesses.id)' })
  @ApiBody({ type: SetBusinessFollowDto })
  @ApiResponse({ status: 200, description: 'Follow state updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async setFollow(
    @Param('businessId') businessId: string,
    @Body() body: SetBusinessFollowDto,
    @ReqContext() ctx: RequestContext
  ) {
    const userId = this.requireUserId(ctx);
    try {
      const result = await this.businessFollowsService.setFollow(
        userId,
        businessId,
        body.following
      );
      return {
        success: true,
        data: result,
        message: body.following ? 'Business followed' : 'Business unfollowed',
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: error?.message || 'Failed to update follow',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List current user followed businesses' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Followed businesses returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listFollows(
    @ReqContext() ctx: RequestContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const userId = this.requireUserId(ctx);
    try {
      const data = await this.businessFollowsService.getUserFollows(
        userId,
        page ? Number(page) : 1,
        limit ? Number(limit) : 20
      );
      return {
        success: true,
        data,
        message: 'Followed businesses retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: error?.message || 'Failed to list follows',
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
