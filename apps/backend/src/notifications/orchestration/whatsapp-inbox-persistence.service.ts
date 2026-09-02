import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { NotificationPreferenceService } from './notification-preference.service';

export type WhatsAppMessageDirection = 'inbound' | 'outbound';
export type WhatsAppMessageSource =
  | 'user'
  | 'agent_inbox'
  | 'template'
  | 'system';
export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'interactive'
  | 'unknown'
  | 'template';
export type WhatsAppDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface WhatsAppConversationRow {
  id: string;
  wa_id: string;
  customer_phone: string;
  user_id: string | null;
  last_customer_message_at: string | null;
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
  status: 'open' | 'closed';
}

export interface PersistInboundParams {
  waId: string;
  customerPhone: string;
  wamid?: string;
  type: WhatsAppMessageType;
  body: string;
  rawPayload: Record<string, unknown>;
  bumpUnread: boolean;
}

export interface PersistOutboundParams {
  waId: string;
  customerPhone: string;
  wamid?: string;
  source: WhatsAppMessageSource;
  type: WhatsAppMessageType;
  body: string;
  rawPayload: Record<string, unknown>;
  senderUserId?: string;
  status?: WhatsAppDeliveryStatus;
  error?: string;
}

@Injectable()
export class WhatsAppInboxPersistenceService {
  private readonly logger = new Logger(WhatsAppInboxPersistenceService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly prefs: NotificationPreferenceService
  ) {}

  async persistInbound(params: PersistInboundParams): Promise<string | null> {
    if (params.wamid && (await this.findMessageIdByWamid(params.wamid))) {
      return null;
    }
    const conversation = await this.upsertConversation({
      waId: params.waId,
      customerPhone: params.customerPhone,
      preview: params.body,
      isCustomerMessage: true,
      bumpUnread: params.bumpUnread,
    });
    return this.insertMessage({
      conversationId: conversation.id,
      wamid: params.wamid,
      direction: 'inbound',
      source: 'user',
      type: params.type,
      body: params.body,
      rawPayload: params.rawPayload,
      status: 'delivered',
    });
  }

  async persistOutbound(params: PersistOutboundParams): Promise<string | null> {
    if (params.wamid && (await this.findMessageIdByWamid(params.wamid))) {
      return null;
    }
    const conversation = await this.upsertConversation({
      waId: params.waId,
      customerPhone: params.customerPhone,
      preview: params.body,
      isCustomerMessage: false,
      bumpUnread: false,
    });
    return this.insertMessage({
      conversationId: conversation.id,
      wamid: params.wamid,
      direction: 'outbound',
      source: params.source,
      type: params.type,
      body: params.body,
      rawPayload: params.rawPayload,
      senderUserId: params.senderUserId,
      status: params.status ?? 'sent',
      error: params.error,
    });
  }

  async markByWamid(
    wamid: string,
    status: WhatsAppDeliveryStatus,
    error?: string
  ): Promise<void> {
    const set: Record<string, unknown> = { status };
    if (error) set.error = error;
    await this.hasura.executeMutation(
      `mutation MarkWa($wamid: String!, $set: whatsapp_messages_set_input!) {
        update_whatsapp_messages(where: { wamid: { _eq: $wamid } }, _set: $set) {
          affected_rows
        }
      }`,
      { wamid, set }
    );
  }

  private async findMessageIdByWamid(wamid: string): Promise<string | null> {
    const res = await this.hasura.executeQuery<{
      whatsapp_messages: Array<{ id: string }>;
    }>(
      `query ByWamid($wamid: String!) {
        whatsapp_messages(where: { wamid: { _eq: $wamid } }, limit: 1) { id }
      }`,
      { wamid }
    );
    return res.whatsapp_messages?.[0]?.id ?? null;
  }

  private async upsertConversation(params: {
    waId: string;
    customerPhone: string;
    preview: string;
    isCustomerMessage: boolean;
    bumpUnread: boolean;
  }): Promise<WhatsAppConversationRow> {
    const existing = await this.findConversationByWaId(params.waId);
    if (existing) {
      return this.updateConversation(existing, params);
    }
    return this.insertConversation(params);
  }

  private async findConversationByWaId(
    waId: string
  ): Promise<WhatsAppConversationRow | null> {
    const res = await this.hasura.executeQuery<{
      whatsapp_conversations: WhatsAppConversationRow[];
    }>(
      `query Conv($waId: String!) {
        whatsapp_conversations(where: { wa_id: { _eq: $waId } }, limit: 1) {
          id wa_id customer_phone user_id last_customer_message_at
          last_message_at last_message_preview unread_count status
        }
      }`,
      { waId }
    );
    return res.whatsapp_conversations?.[0] ?? null;
  }

  private async insertConversation(params: {
    waId: string;
    customerPhone: string;
    preview: string;
    isCustomerMessage: boolean;
    bumpUnread: boolean;
  }): Promise<WhatsAppConversationRow> {
    const now = new Date().toISOString();
    const userId = await this.prefs.findUserIdByPhoneE164(params.customerPhone);
    const object = {
      wa_id: params.waId,
      customer_phone: params.customerPhone,
      user_id: userId,
      last_message_at: now,
      last_message_preview: this.clipPreview(params.preview),
      last_customer_message_at: params.isCustomerMessage ? now : null,
      unread_count: params.bumpUnread ? 1 : 0,
      status: 'open',
      updated_at: now,
    };
    const res = await this.hasura.executeMutation<{
      insert_whatsapp_conversations_one: WhatsAppConversationRow;
    }>(
      `mutation InsConv($object: whatsapp_conversations_insert_input!) {
        insert_whatsapp_conversations_one(object: $object) {
          id wa_id customer_phone user_id last_customer_message_at
          last_message_at last_message_preview unread_count status
        }
      }`,
      { object }
    );
    return res.insert_whatsapp_conversations_one;
  }

  private async updateConversation(
    existing: WhatsAppConversationRow,
    params: {
      customerPhone: string;
      preview: string;
      isCustomerMessage: boolean;
      bumpUnread: boolean;
    }
  ): Promise<WhatsAppConversationRow> {
    const now = new Date().toISOString();
    const set: Record<string, unknown> = {
      customer_phone: params.customerPhone,
      last_message_at: now,
      last_message_preview: this.clipPreview(params.preview),
      status: 'open',
      updated_at: now,
    };
    if (params.isCustomerMessage) set.last_customer_message_at = now;
    if (params.bumpUnread) {
      set.unread_count = (existing.unread_count ?? 0) + 1;
    }
    if (!existing.user_id) {
      set.user_id = await this.prefs.findUserIdByPhoneE164(params.customerPhone);
    }
    const res = await this.hasura.executeMutation<{
      update_whatsapp_conversations_by_pk: WhatsAppConversationRow;
    }>(
      `mutation UpdConv($id: uuid!, $set: whatsapp_conversations_set_input!) {
        update_whatsapp_conversations_by_pk(pk_columns: { id: $id }, _set: $set) {
          id wa_id customer_phone user_id last_customer_message_at
          last_message_at last_message_preview unread_count status
        }
      }`,
      { id: existing.id, set }
    );
    return res.update_whatsapp_conversations_by_pk;
  }

  private async insertMessage(params: {
    conversationId: string;
    wamid?: string;
    direction: WhatsAppMessageDirection;
    source: WhatsAppMessageSource;
    type: WhatsAppMessageType;
    body: string;
    rawPayload: Record<string, unknown>;
    senderUserId?: string;
    status: WhatsAppDeliveryStatus;
    error?: string;
  }): Promise<string> {
    try {
      const res = await this.hasura.executeMutation<{
        insert_whatsapp_messages_one: { id: string };
      }>(
        `mutation InsMsg($object: whatsapp_messages_insert_input!) {
          insert_whatsapp_messages_one(object: $object) { id }
        }`,
        {
          object: {
            conversation_id: params.conversationId,
            wamid: params.wamid ?? null,
            direction: params.direction,
            source: params.source,
            type: params.type,
            body: params.body,
            raw_payload: params.rawPayload,
            sender_user_id: params.senderUserId ?? null,
            status: params.status,
            error: params.error ?? null,
          },
        }
      );
      return res.insert_whatsapp_messages_one.id;
    } catch (error: any) {
      this.logger.warn(
        `Failed to insert WhatsApp message: ${error?.message ?? String(error)}`
      );
      throw error;
    }
  }

  private clipPreview(body: string): string {
    const trimmed = (body || '').trim();
    if (!trimmed) return '(attachment)';
    return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
  }
}
