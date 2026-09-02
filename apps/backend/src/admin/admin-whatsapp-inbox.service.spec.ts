import { ConflictException, NotFoundException } from '@nestjs/common';
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
});
