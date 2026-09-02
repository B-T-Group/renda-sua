import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminWhatsAppInboxService } from './admin-whatsapp-inbox.service';
import {
  ListWhatsAppInboxMessagesQueryDto,
  ListWhatsAppInboxQueryDto,
  PatchWhatsAppInboxConversationDto,
  SendWhatsAppInboxMessageDto,
} from './dto/whatsapp-inbox.dto';

const QUERY_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@ApiTags('admin-whatsapp-inbox')
@Controller('admin/whatsapp/inbox')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.OPS_WHATSAPP_INBOX)
@ApiBearerAuth()
export class AdminWhatsAppInboxController {
  constructor(
    private readonly service: AdminWhatsAppInboxService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get()
  @UsePipes(QUERY_PIPE)
  @ApiOperation({
    summary: 'List WhatsApp support conversations',
    operationId: 'adminListWhatsAppInbox',
  })
  @ApiResponse({ status: 200, description: 'Conversation list' })
  list(@Query() query: ListWhatsAppInboxQueryDto) {
    return this.service.listConversations(query);
  }

  @Get(':id/messages')
  @UsePipes(QUERY_PIPE)
  @ApiOperation({
    summary: 'List messages in a WhatsApp conversation',
    operationId: 'adminListWhatsAppInboxMessages',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Message thread' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  listMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListWhatsAppInboxMessagesQueryDto
  ) {
    return this.service.listMessages(id, query);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  @UsePipes(QUERY_PIPE)
  @ApiOperation({
    summary: 'Send a free-form WhatsApp reply (24h session window)',
    operationId: 'adminSendWhatsAppInboxMessage',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: SendWhatsAppInboxMessageDto })
  @ApiResponse({ status: 200, description: 'Reply sent' })
  @ApiResponse({ status: 409, description: 'SESSION_EXPIRED' })
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendWhatsAppInboxMessageDto
  ) {
    const user = await this.hasuraUserService.getUser();
    return this.service.sendReply(id, user.id, body);
  }

  @Patch(':id')
  @UsePipes(QUERY_PIPE)
  @ApiOperation({
    summary: 'Mark conversation read or update status',
    operationId: 'adminPatchWhatsAppInboxConversation',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: PatchWhatsAppInboxConversationDto })
  @ApiResponse({ status: 200, description: 'Conversation updated' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PatchWhatsAppInboxConversationDto
  ) {
    return this.service.patchConversation(id, body);
  }
}
