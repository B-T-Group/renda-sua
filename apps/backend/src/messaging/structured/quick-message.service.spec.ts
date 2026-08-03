import { HttpException, HttpStatus } from '@nestjs/common';
import { QuickMessageService } from './quick-message.service';

describe('QuickMessageService', () => {
  const agentUser = {
    id: 'agent-user',
    active_persona: 'agent',
    agent: { id: 'agent-1' },
  };

  const order = {
    id: 'order-1',
    order_number: 'ORD-1',
    business_id: 'biz-1',
    client_id: 'client-1',
    assigned_agent_id: 'agent-1',
    current_status: 'out_for_delivery',
    fulfillment_method: 'delivery',
    client: { user_id: 'client-user', user: { first_name: 'C', last_name: 'L' } },
    business: { user_id: 'biz-user', user: { first_name: 'B', last_name: 'Z' } },
    assigned_agent: {
      user_id: 'agent-user',
      user: { first_name: 'A', last_name: 'G' },
    },
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(agentUser),
    };
    const hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({
        insert_user_messages_one: {
          id: 'msg-1',
          user_id: agentUser.id,
          entity_type: 'order',
          entity_id: order.id,
          message: '{}',
          created_at: '2026-08-03T00:00:00.000Z',
          updated_at: '2026-08-03T00:00:00.000Z',
          user: {
            id: agentUser.id,
            email: 'a@test.com',
            first_name: 'A',
            last_name: 'G',
          },
        },
      }),
    };
    const messagingService = {
      loadOrderForMessagingPublic: jest.fn().mockResolvedValue(order),
      assertMessagingAccess: jest.fn().mockResolvedValue(undefined),
      enrichSingleMessage: jest.fn().mockImplementation((msg) => msg),
    };
    const orderParticipantsService = {
      getParticipants: jest.fn().mockReturnValue([
        { userId: 'client-user', persona: 'client', displayName: 'C L' },
        { userId: 'biz-user', persona: 'business', displayName: 'B Z' },
        {
          userId: 'agent-user',
          persona: 'agent',
          displayName: 'A G',
          isAssigned: true,
        },
      ]),
      resolvePersona: jest.fn().mockReturnValue('agent'),
    };
    const quickMessageHandler = {
      buildPayload: jest.fn().mockImplementation(
        (templateId: string, taggedUserIds: string[], taggedPersonas: string[]) => ({
          version: 1,
          templateId,
          taggedUserIds,
          taggedPersonas,
        })
      ),
      buildDisplayMessageForTemplate: jest
        .fn()
        .mockReturnValue(JSON.stringify({ i18nKey: 'x' })),
      resolveRecipients: jest.fn().mockImplementation((_o, payload) =>
        payload.taggedUserIds.map((userId: string) => ({
          userId,
          type: 'mentioned',
        }))
      ),
    };
    const eventEmitter = { emit: jest.fn() };
    const configService = {
      get: jest.fn().mockReturnValue({ targetedRoutingEnabled: true }),
    };

    const service = new QuickMessageService(
      (overrides.hasuraUserService as any) ?? (hasuraUserService as any),
      (overrides.hasuraSystemService as any) ?? (hasuraSystemService as any),
      (overrides.messagingService as any) ?? (messagingService as any),
      (overrides.orderParticipantsService as any) ??
        (orderParticipantsService as any),
      (overrides.quickMessageHandler as any) ?? (quickMessageHandler as any),
      (overrides.eventEmitter as any) ?? (eventEmitter as any),
      (overrides.configService as any) ?? (configService as any)
    );

    return {
      service,
      hasuraSystemService,
      eventEmitter,
      messagingService,
    };
  }

  it('sends agent_arrived with nested client mention and recipients', async () => {
    const { service, hasuraSystemService, eventEmitter } = createService();
    await service.sendQuickMessage(order.id, 'agent_arrived');

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledTimes(1);
    const [, vars] = hasuraSystemService.executeMutation.mock.calls[0];
    expect(vars.mentions).toEqual([
      { mentioned_user_id: 'client-user', mentioned_persona: 'client' },
    ]);
    expect(vars.recipients).toEqual([
      { recipient_user_id: 'client-user', recipient_type: 'mentioned' },
    ]);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'message.created',
      expect.objectContaining({
        messageType: 'QUICK_MESSAGE',
        quickMessageTemplateId: 'agent_arrived',
      })
    );
  });

  it('tags client and business for client_unreachable', async () => {
    const { service, hasuraSystemService } = createService();
    await service.sendQuickMessage(order.id, 'client_unreachable');

    const [, vars] = hasuraSystemService.executeMutation.mock.calls[0];
    expect(vars.mentions).toHaveLength(2);
    expect(
      vars.mentions.map((o: { mentioned_persona: string }) => o.mentioned_persona)
    ).toEqual(['client', 'business']);
  });

  it('rejects unknown templates', async () => {
    const { service } = createService();
    await expect(service.sendQuickMessage(order.id, 'nope')).rejects.toBeInstanceOf(
      HttpException
    );
  });

  it('rate limits repeated sends of the same template after success', async () => {
    const { service } = createService();
    await service.sendQuickMessage(order.id, 'agent_arrived');
    try {
      await service.sendQuickMessage(order.id, 'agent_arrived');
      fail('expected rate limit');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('does not rate limit when the first send fails before completion', async () => {
    const { service, hasuraSystemService } = createService();
    hasuraSystemService.executeMutation
      .mockResolvedValueOnce({ insert_user_messages_one: null })
      .mockResolvedValueOnce({
        insert_user_messages_one: {
          id: 'msg-2',
          user_id: agentUser.id,
          entity_type: 'order',
          entity_id: order.id,
          message: '{}',
          created_at: '2026-08-03T00:00:00.000Z',
          updated_at: '2026-08-03T00:00:00.000Z',
          user: {
            id: agentUser.id,
            email: 'a@test.com',
            first_name: 'A',
            last_name: 'G',
          },
        },
      });

    await expect(
      service.sendQuickMessage(order.id, 'agent_arrived')
    ).rejects.toBeInstanceOf(HttpException);

    await expect(
      service.sendQuickMessage(order.id, 'agent_arrived')
    ).resolves.toBeTruthy();
  });

  it('lists only eligible templates for the agent', async () => {
    const { service } = createService();
    const templates = await service.listEligibleTemplates(order.id);
    const ids = templates.map((t) => t.id);
    expect(ids).toContain('agent_arrived');
    expect(ids).toContain('client_unreachable');
    expect(ids).not.toContain('client_coming_down');
  });
});
