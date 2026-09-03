import { WhatsAppInboxPersistenceService } from './whatsapp-inbox-persistence.service';

describe('WhatsAppInboxPersistenceService', () => {
  const NOW = '2026-09-03T10:00:00.000Z';
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const prefs = { findUserIdByPhoneE164: jest.fn() };
  const service = new WhatsAppInboxPersistenceService(
    hasura as never,
    prefs as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    prefs.findUserIdByPhoneE164.mockResolvedValue('user-1');
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ByWamid')) return { whatsapp_messages: [] };
      if (query.includes('Conv(')) return { whatsapp_conversations: [] };
      return {};
    });
    hasura.executeMutation.mockImplementation(async (query: string, vars: any) => {
      if (query.includes('InsConv')) {
        return { insert_whatsapp_conversations_one: { id: 'c1', ...vars.object } };
      }
      if (query.includes('UpdConv')) {
        return { update_whatsapp_conversations_by_pk: { id: vars.id, ...vars.set } };
      }
      if (query.includes('InsMsg')) {
        return { insert_whatsapp_messages_one: { id: 'm1' } };
      }
      if (query.includes('MarkWa')) {
        return { update_whatsapp_messages: { affected_rows: 1 } };
      }
      return {};
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null for a duplicate inbound wamid and does not insert', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ByWamid')) {
        return { whatsapp_messages: [{ id: 'existing' }] };
      }
      return { whatsapp_conversations: [] };
    });
    const id = await service.persistInbound({
      waId: '1555',
      customerPhone: '1555',
      wamid: 'wamid.dup',
      type: 'text',
      body: 'Hi',
      rawPayload: {},
      bumpUnread: true,
    });
    expect(id).toBeNull();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('opens a conversation with unread 1 and clips an empty preview', async () => {
    const id = await service.persistInbound({
      waId: '1555',
      customerPhone: '+1 555 765 4321',
      wamid: 'wamid.in',
      type: 'image',
      body: '   ',
      rawPayload: { type: 'image' },
      bumpUnread: true,
    });
    expect(id).toBe('m1');
    const conv = hasura.executeMutation.mock.calls.find(([q]) =>
      String(q).includes('InsConv')
    )?.[1].object;
    expect(conv).toMatchObject({
      unread_count: 1,
      last_customer_message_at: NOW,
      last_message_preview: '(attachment)',
      user_id: 'user-1',
      status: 'open',
    });
  });

  it('does not bump unread on outbound and truncates long previews', async () => {
    const body = 'x'.repeat(200);
    await service.persistOutbound({
      waId: '1555',
      customerPhone: '1555',
      wamid: 'wamid.out',
      source: 'agent_inbox',
      type: 'text',
      body,
      rawPayload: {},
      senderUserId: 'agent-1',
    });
    const conv = hasura.executeMutation.mock.calls.find(([q]) =>
      String(q).includes('InsConv')
    )?.[1].object;
    expect(conv.unread_count).toBe(0);
    expect(conv.last_customer_message_at).toBeNull();
    expect(conv.last_message_preview).toBe(`${'x'.repeat(157)}...`);
  });

  it('increments unread on an existing inbound and links a missing user', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ByWamid')) return { whatsapp_messages: [] };
      if (query.includes('Conv(')) {
        return {
          whatsapp_conversations: [
            {
              id: 'c1',
              wa_id: '1555',
              customer_phone: '1555',
              user_id: null,
              unread_count: 3,
              status: 'closed',
            },
          ],
        };
      }
      return {};
    });
    await service.persistInbound({
      waId: '1555',
      customerPhone: '15557654321',
      type: 'text',
      body: 'Help',
      rawPayload: {},
      bumpUnread: true,
    });
    const set = hasura.executeMutation.mock.calls.find(([q]) =>
      String(q).includes('UpdConv')
    )?.[1].set;
    expect(set).toMatchObject({
      unread_count: 4,
      last_customer_message_at: NOW,
      status: 'open',
      user_id: 'user-1',
    });
  });

  it('does not increment unread when persisting outbound to an existing thread', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ByWamid')) return { whatsapp_messages: [] };
      if (query.includes('Conv(')) {
        return {
          whatsapp_conversations: [
            {
              id: 'c1',
              wa_id: '1555',
              customer_phone: '1555',
              user_id: 'user-1',
              unread_count: 2,
              status: 'open',
            },
          ],
        };
      }
      return {};
    });
    await service.persistOutbound({
      waId: '1555',
      customerPhone: '1555',
      source: 'template',
      type: 'template',
      body: 'New order',
      rawPayload: {},
    });
    const set = hasura.executeMutation.mock.calls.find(([q]) =>
      String(q).includes('UpdConv')
    )?.[1].set;
    expect(set.unread_count).toBeUndefined();
    expect(set.last_customer_message_at).toBeUndefined();
  });

  it('stores delivery status and error by wamid', async () => {
    await service.markByWamid('wamid.fail', 'failed', '131026');
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkWa'),
      { wamid: 'wamid.fail', set: { status: 'failed', error: '131026' } }
    );
  });
});
