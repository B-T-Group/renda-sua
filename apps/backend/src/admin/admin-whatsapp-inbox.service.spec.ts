import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AdminWhatsAppInboxService } from './admin-whatsapp-inbox.service';

describe('AdminWhatsAppInboxService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const whatsApp = {
    isConfigured: jest.fn().mockReturnValue(true),
    sendSessionText: jest.fn(),
    downloadMedia: jest.fn(),
  };
  const inbox = {
    persistOutbound: jest.fn().mockResolvedValue('msg-1'),
  };

  const openConversation = {
    id: '11111111-1111-4111-8111-111111111111',
    wa_id: '15557654321',
    customer_phone: '15557654321',
    user_id: null,
    last_customer_message_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    last_message_preview: 'Hi',
    unread_count: 1,
    status: 'open' as const,
    user: null,
  };

  let service: AdminWhatsAppInboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    whatsApp.isConfigured.mockReturnValue(true);
    service = new AdminWhatsAppInboxService(
      hasura as never,
      whatsApp as never,
      inbox as never
    );
  });

  it('lists conversations', async () => {
    hasura.executeQuery.mockResolvedValue({
      whatsapp_conversations: [openConversation],
      whatsapp_conversations_aggregate: { aggregate: { count: 1 } },
    });
    const result = await service.listConversations({ status: 'open' });
    expect(result.total).toBe(1);
    expect(result.items[0].waId).toBe('15557654321');
    expect(result.items[0].canReply).toBe(true);
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        where: {
          _and: [
            { last_customer_message_at: { _is_null: false } },
            { status: { _eq: 'open' } },
          ],
        },
      })
    );
  });

  it('rejects reply when session expired', async () => {
    hasura.executeQuery.mockResolvedValue({
      whatsapp_conversations_by_pk: {
        ...openConversation,
        last_customer_message_at: new Date(
          Date.now() - 25 * 60 * 60 * 1000
        ).toISOString(),
      },
    });
    await expect(
      service.sendReply(openConversation.id, 'agent-1', { body: 'Hello' })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(whatsApp.sendSessionText).not.toHaveBeenCalled();
  });

  it('sends session text and persists outbound', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        whatsapp_conversations_by_pk: openConversation,
      })
      .mockResolvedValueOnce({
        whatsapp_conversations_by_pk: {
          ...openConversation,
          unread_count: 0,
          last_message_preview: 'Hello',
        },
      });
    whatsApp.sendSessionText.mockResolvedValue({
      messages: [{ id: 'wamid.out' }],
    });

    const result = await service.sendReply(openConversation.id, 'agent-1', {
      body: 'Hello',
    });

    expect(whatsApp.sendSessionText).toHaveBeenCalledWith({
      to: '15557654321',
      body: 'Hello',
    });
    expect(inbox.persistOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'agent_inbox',
        wamid: 'wamid.out',
        senderUserId: 'agent-1',
      })
    );
    expect(result.wamid).toBe('wamid.out');
  });

  it('throws when conversation missing', async () => {
    hasura.executeQuery.mockResolvedValue({
      whatsapp_conversations_by_pk: null,
    });
    await expect(
      service.listMessages('11111111-1111-4111-8111-111111111111', {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('defaults the list filter to open and searches phone or user fields', async () => {
    hasura.executeQuery.mockResolvedValue({
      whatsapp_conversations: [],
      whatsapp_conversations_aggregate: { aggregate: { count: 0 } },
    });
    await service.listConversations({ search: '  Ada  ' });
    expect(hasura.executeQuery.mock.calls[0][1].where).toEqual({
      _and: [
        { status: { _eq: 'open' } },
        {
          _or: [
            { customer_phone: { _ilike: '%Ada%' } },
            { wa_id: { _ilike: '%Ada%' } },
            { user: { first_name: { _ilike: '%Ada%' } } },
            { user: { last_name: { _ilike: '%Ada%' } } },
            { user: { email: { _ilike: '%Ada%' } } },
          ],
        },
      ],
    });
  });

  it('lists every conversation when status is all', async () => {
    hasura.executeQuery.mockResolvedValue({
      whatsapp_conversations: [],
      whatsapp_conversations_aggregate: { aggregate: { count: 0 } },
    });
    await service.listConversations({ status: 'all' });
    expect(hasura.executeQuery.mock.calls[0][1].where).toEqual({});
  });

  it('rejects reply when the last customer message is missing or invalid', async () => {
    hasura.executeQuery.mockResolvedValue({
      whatsapp_conversations_by_pk: {
        ...openConversation,
        last_customer_message_at: null,
      },
    });
    await expect(
      service.sendReply(openConversation.id, 'agent-1', { body: 'Hello' })
    ).rejects.toBeInstanceOf(ConflictException);

    hasura.executeQuery.mockResolvedValue({
      whatsapp_conversations_by_pk: {
        ...openConversation,
        last_customer_message_at: 'not-a-date',
      },
    });
    await expect(
      service.sendReply(openConversation.id, 'agent-1', { body: 'Hello' })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(whatsApp.sendSessionText).not.toHaveBeenCalled();
  });

  it('rejects reply when WhatsApp is not configured', async () => {
    whatsApp.isConfigured.mockReturnValue(false);
    hasura.executeQuery.mockResolvedValue({
      whatsapp_conversations_by_pk: openConversation,
    });
    await expect(
      service.sendReply(openConversation.id, 'agent-1', { body: 'Hello' })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(inbox.persistOutbound).not.toHaveBeenCalled();
  });

  it('marks a conversation read without closing it', async () => {
    hasura.executeQuery.mockResolvedValue({
      whatsapp_conversations_by_pk: openConversation,
    });
    hasura.executeMutation.mockResolvedValue({
      update_whatsapp_conversations_by_pk: {
        ...openConversation,
        unread_count: 0,
      },
    });
    const result = await service.patchConversation(openConversation.id, {
      markRead: true,
    });
    expect(hasura.executeMutation.mock.calls[0][1].set).toMatchObject({
      unread_count: 0,
    });
    expect(hasura.executeMutation.mock.calls[0][1].set.status).toBeUndefined();
    expect(result.conversation.unreadCount).toBe(0);
  });

  it('exposes media metadata from raw_payload on thread messages', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        whatsapp_conversations_by_pk: openConversation,
      })
      .mockResolvedValueOnce({
        whatsapp_messages: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            conversation_id: openConversation.id,
            wamid: 'wamid.img',
            direction: 'inbound',
            source: 'user',
            type: 'image',
            body: '[Image]',
            raw_payload: {
              type: 'image',
              image: { id: 'media-1', mime_type: 'image/jpeg', caption: 'Hi' },
            },
            sender_user_id: null,
            status: 'delivered',
            error: null,
            created_at: openConversation.last_message_at,
            sender_user: null,
          },
        ],
        whatsapp_messages_aggregate: { aggregate: { count: 1 } },
      });
    const result = await service.listMessages(openConversation.id, {});
    expect(result.items[0].media).toMatchObject({
      id: 'media-1',
      mimeType: 'image/jpeg',
      caption: 'Hi',
    });
  });

  it('shows template button taps as text instead of unknown attachments', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        whatsapp_conversations_by_pk: openConversation,
      })
      .mockResolvedValueOnce({
        whatsapp_messages: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            conversation_id: openConversation.id,
            wamid: 'wamid.btn',
            direction: 'inbound',
            source: 'user',
            type: 'unknown',
            body: '[unknown]',
            raw_payload: {
              type: 'button',
              button: { text: 'Confirmer', payload: 'Confirmer' },
            },
            sender_user_id: null,
            status: 'delivered',
            error: null,
            created_at: openConversation.last_message_at,
            sender_user: null,
          },
        ],
        whatsapp_messages_aggregate: { aggregate: { count: 1 } },
      });
    const result = await service.listMessages(openConversation.id, {});
    expect(result.items[0].type).toBe('text');
    expect(result.items[0].body).toBe('Confirmer');
  });

  it('proxies Graph media for a message with an attachment id', async () => {
    hasura.executeQuery.mockResolvedValue({
      whatsapp_messages_by_pk: {
        id: '22222222-2222-4222-8222-222222222222',
        conversation_id: openConversation.id,
        type: 'document',
        raw_payload: {
          document: {
            id: 'doc-1',
            filename: 'invoice.pdf',
            mime_type: 'application/pdf',
          },
        },
      },
    });
    whatsApp.downloadMedia.mockResolvedValue({
      buffer: Buffer.from('pdf-bytes'),
      mimeType: 'application/octet-stream',
    });
    const file = await service.downloadMessageMedia(
      '22222222-2222-4222-8222-222222222222'
    );
    expect(whatsApp.downloadMedia).toHaveBeenCalledWith('doc-1');
    expect(file.mimeType).toBe('application/pdf');
    expect(file.filename).toBe('invoice.pdf');
    expect(file.contentDisposition).toContain('invoice.pdf');
  });

  it('rejects media download when the message has no attachment', async () => {
    hasura.executeQuery.mockResolvedValue({
      whatsapp_messages_by_pk: {
        id: '33333333-3333-4333-8333-333333333333',
        type: 'text',
        raw_payload: { text: { body: 'hi' } },
      },
    });
    await expect(
      service.downloadMessageMedia('33333333-3333-4333-8333-333333333333')
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
