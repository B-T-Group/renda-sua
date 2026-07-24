import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { MessagesService } from './messages.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';

@ApiTags('messages')
@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly messagesService: MessagesService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user messages' })
  @ApiQuery({ name: 'entity_type', required: false })
  @ApiQuery({ name: 'entity_id', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Messages for the current user' })
  async getMyMessages(
    @ReqContext() ctx: RequestContext,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const user = await this.hasuraUserService.getUser(ctx);
      const result = await this.messagesService.getMyMessages(user.id, {
        entity_type: entityType,
        entity_id: entityId,
        search,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return { success: true, messages: result.messages };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch messages',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread message count for the current user' })
  @ApiResponse({ status: 200, description: 'Unread message count' })
  async getUnreadCount(@ReqContext() ctx: RequestContext) {
    try {
      const user = await this.hasuraUserService.getUser(ctx);
      const count = await this.messagesService.getUnreadCount(user.id);
      return { success: true, count };
    } catch (error: any) {
      throw new HttpException(
        { success: false, error: error.message || 'Failed to fetch unread count' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a single message as read' })
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  async markRead(@ReqContext() ctx: RequestContext, @Param('id') id: string) {
    try {
      const user = await this.hasuraUserService.getUser(ctx);
      await this.messagesService.markRead(user.id, id);
      return { success: true };
    } catch (error: any) {
      throw new HttpException(
        { success: false, error: error.message || 'Failed to mark message as read' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all messages as read for the current user' })
  @ApiResponse({ status: 200, description: 'All messages marked as read' })
  async markAllRead(@ReqContext() ctx: RequestContext) {
    try {
      const user = await this.hasuraUserService.getUser(ctx);
      const result = await this.messagesService.markAllRead(user.id);
      return { success: true, count: result.count };
    } catch (error: any) {
      throw new HttpException(
        { success: false, error: error.message || 'Failed to mark all messages as read' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('entity-types')
  @ApiOperation({ summary: 'Get entity types for messages' })
  @ApiResponse({ status: 200, description: 'List of entity types' })
  async getEntityTypes() {
    try {
      const entityTypes = await this.messagesService.getEntityTypes();
      return { success: true, entity_types: entityTypes };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch entity types',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
