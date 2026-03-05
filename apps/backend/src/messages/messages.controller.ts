import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { MessagesService } from './messages.service';

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
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const user = await this.hasuraUserService.getUser();
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
