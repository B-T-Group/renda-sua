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
});
