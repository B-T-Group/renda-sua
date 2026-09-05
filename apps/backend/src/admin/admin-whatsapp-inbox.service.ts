import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { WhatsAppInboxPersistenceService } from '../notifications/orchestration/whatsapp-inbox-persistence.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import {
  inboxDisplayMessage,
  inboxMediaFromPayload,
  mediaContentDisposition,
} from '../whatsapp/whatsapp-inbox-media.util';
import type {
  ListWhatsAppInboxMessagesQueryDto,
  ListWhatsAppInboxQueryDto,
  PatchWhatsAppInboxConversationDto,
  SendWhatsAppInboxMessageDto,
} from './dto/whatsapp-inbox.dto';

const SESSION_MS = 24 * 60 * 60 * 1000;

interface ConversationRow {
  id: string;
  wa_id: string;
  customer_phone: string;
  user_id: string | null;
  last_customer_message_at: string | null;
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
  status: 'open' | 'closed';
  user?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  wamid: string | null;
  direction: 'inbound' | 'outbound';
  source: string;
  type: string;
  body: string;
  raw_payload?: unknown;
  sender_user_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
  sender_user?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

@Injectable()
export class AdminWhatsAppInboxService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly whatsApp: WhatsAppService,
    private readonly inbox: WhatsAppInboxPersistenceService
  ) {}

  async listConversations(query: ListWhatsAppInboxQueryDto) {
    const limit = Number(query.limit ?? 30);
    const offset = Number(query.offset ?? 0);
    const where = this.buildListWhere(query);
    const res = await this.hasura.executeQuery<{
      whatsapp_conversations: ConversationRow[];
      whatsapp_conversations_aggregate: { aggregate: { count: number } };
    }>(
      `query ListInbox($where: whatsapp_conversations_bool_exp!, $limit: Int!, $offset: Int!) {
        whatsapp_conversations(
          where: $where
          order_by: [{ unread_count: desc }, { last_message_at: desc }]
          limit: $limit
          offset: $offset
        ) {
          id wa_id customer_phone user_id last_customer_message_at
          last_message_at last_message_preview unread_count status
          user { id first_name last_name email }
        }
        whatsapp_conversations_aggregate(where: $where) {
          aggregate { count }
        }
      }`,
      { where, limit, offset }
    );
    const items = (res.whatsapp_conversations ?? []).map((c) =>
      this.toConversationDto(c)
    );
    return {
      items,
      total: res.whatsapp_conversations_aggregate?.aggregate?.count ?? 0,
      configured: this.whatsApp.isConfigured(),
    };
  }

  async listMessages(
    conversationId: string,
    query: ListWhatsAppInboxMessagesQueryDto
  ) {
    const conversation = await this.requireConversation(conversationId);
    const limit = Number(query.limit ?? 50);
    const offset = Number(query.offset ?? 0);
    const res = await this.hasura.executeQuery<{
      whatsapp_messages: MessageRow[];
      whatsapp_messages_aggregate: { aggregate: { count: number } };
    }>(
      `query ListMsgs($id: uuid!, $limit: Int!, $offset: Int!) {
        whatsapp_messages(
          where: {
            conversation_id: { _eq: $id }
            source: { _neq: "template" }
          }
          order_by: { created_at: asc }
          limit: $limit
          offset: $offset
        ) {
          id conversation_id wamid direction source type body raw_payload
          sender_user_id status error created_at
          sender_user { id first_name last_name }
        }
        whatsapp_messages_aggregate(
          where: {
            conversation_id: { _eq: $id }
            source: { _neq: "template" }
          }
        ) {
          aggregate { count }
        }
      }`,
      { id: conversationId, limit, offset }
    );
    return {
      conversation: this.toConversationDto(conversation),
      items: (res.whatsapp_messages ?? []).map((m) => this.toMessageDto(m)),
      total: res.whatsapp_messages_aggregate?.aggregate?.count ?? 0,
      canReply: this.isSessionOpen(conversation.last_customer_message_at),
    };
  }

  async sendReply(
    conversationId: string,
    agentUserId: string,
    dto: SendWhatsAppInboxMessageDto
  ) {
    const conversation = await this.requireConversation(conversationId);
    this.assertCanReply(conversation);
    if (!this.whatsApp.isConfigured()) {
      throw new ServiceUnavailableException('WhatsApp is not configured');
    }
    const body = dto.body.trim();
    const result = await this.whatsApp.sendSessionText({
      to: conversation.customer_phone,
      body,
    });
    const wamid = result.messages[0]?.id;
    await this.inbox.persistOutbound({
      waId: conversation.wa_id,
      customerPhone: conversation.customer_phone,
      wamid,
      source: 'agent_inbox',
      type: 'text',
      body,
      rawPayload: { body, sentBy: agentUserId },
      senderUserId: agentUserId,
      status: 'sent',
    });
    return {
      wamid,
      conversation: this.toConversationDto(
        await this.requireConversation(conversationId)
      ),
    };
  }

  async patchConversation(
    conversationId: string,
    dto: PatchWhatsAppInboxConversationDto
  ) {
    await this.requireConversation(conversationId);
    const set: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.markRead === true) set.unread_count = 0;
    if (dto.status) set.status = dto.status;
    const res = await this.hasura.executeMutation<{
      update_whatsapp_conversations_by_pk: ConversationRow;
    }>(
      `mutation PatchConv($id: uuid!, $set: whatsapp_conversations_set_input!) {
        update_whatsapp_conversations_by_pk(pk_columns: { id: $id }, _set: $set) {
          id wa_id customer_phone user_id last_customer_message_at
          last_message_at last_message_preview unread_count status
          user { id first_name last_name email }
        }
      }`,
      { id: conversationId, set }
    );
    return {
      conversation: this.toConversationDto(
        res.update_whatsapp_conversations_by_pk
      ),
    };
  }

  async downloadMessageMedia(messageId: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string | null;
    contentDisposition: string | null;
  }> {
    const row = await this.requireMessage(messageId);
    const media = inboxMediaFromPayload(row.type, row.raw_payload);
    if (!media?.id) {
      throw new NotFoundException('Message has no downloadable attachment');
    }
    const file = await this.whatsApp.downloadMedia(media.id);
    return {
      buffer: file.buffer,
      mimeType: media.mimeType || file.mimeType,
      filename: media.filename,
      contentDisposition: mediaContentDisposition(media.filename),
    };
  }

  private buildListWhere(
    query: ListWhatsAppInboxQueryDto
  ): Record<string, unknown> {
    const clauses: Record<string, unknown>[] = [
      { last_customer_message_at: { _is_null: false } },
    ];
    const status = query.status ?? 'open';
    if (status !== 'all') clauses.push({ status: { _eq: status } });
    const search = query.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      clauses.push({
        _or: [
          { customer_phone: { _ilike: pattern } },
          { wa_id: { _ilike: pattern } },
          { user: { first_name: { _ilike: pattern } } },
          { user: { last_name: { _ilike: pattern } } },
          { user: { email: { _ilike: pattern } } },
        ],
      });
    }
    return clauses.length === 1 ? clauses[0] : { _and: clauses };
  }

  private async requireConversation(id: string): Promise<ConversationRow> {
    const res = await this.hasura.executeQuery<{
      whatsapp_conversations_by_pk: ConversationRow | null;
    }>(
      `query GetConv($id: uuid!) {
        whatsapp_conversations_by_pk(id: $id) {
          id wa_id customer_phone user_id last_customer_message_at
          last_message_at last_message_preview unread_count status
          user { id first_name last_name email }
        }
      }`,
      { id }
    );
    const row = res.whatsapp_conversations_by_pk;
    if (!row) throw new NotFoundException('Conversation not found');
    return row;
  }

  private async requireMessage(id: string): Promise<MessageRow> {
    const res = await this.hasura.executeQuery<{
      whatsapp_messages_by_pk: MessageRow | null;
    }>(
      `query GetInboxMsg($id: uuid!) {
        whatsapp_messages_by_pk(id: $id) {
          id conversation_id type raw_payload
        }
      }`,
      { id }
    );
    const row = res.whatsapp_messages_by_pk;
    if (!row) throw new NotFoundException('Message not found');
    return row;
  }

  private assertCanReply(conversation: ConversationRow): void {
    if (!this.isSessionOpen(conversation.last_customer_message_at)) {
      throw new ConflictException({
        code: 'SESSION_EXPIRED',
        message:
          'The 24-hour WhatsApp customer care window has expired. Wait for the customer to message again.',
      });
    }
  }

  private isSessionOpen(lastCustomerMessageAt: string | null): boolean {
    if (!lastCustomerMessageAt) return false;
    const at = Date.parse(lastCustomerMessageAt);
    if (Number.isNaN(at)) return false;
    return Date.now() - at <= SESSION_MS;
  }

  private toConversationDto(row: ConversationRow) {
    const name = [row.user?.first_name, row.user?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      id: row.id,
      waId: row.wa_id,
      customerPhone: row.customer_phone,
      userId: row.user_id,
      userDisplayName: name || null,
      userEmail: row.user?.email ?? null,
      lastCustomerMessageAt: row.last_customer_message_at,
      lastMessageAt: row.last_message_at,
      lastMessagePreview: row.last_message_preview,
      unreadCount: row.unread_count,
      status: row.status,
      canReply: this.isSessionOpen(row.last_customer_message_at),
    };
  }

  private toMessageDto(row: MessageRow) {
    const senderName = [row.sender_user?.first_name, row.sender_user?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const display = inboxDisplayMessage(row.type, row.body, row.raw_payload);
    return {
      id: row.id,
      conversationId: row.conversation_id,
      wamid: row.wamid,
      direction: row.direction,
      source: row.source,
      type: display.type,
      body: display.body,
      senderUserId: row.sender_user_id,
      senderDisplayName: senderName || null,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
      media: inboxMediaFromPayload(row.type, row.raw_payload),
    };
  }
}
