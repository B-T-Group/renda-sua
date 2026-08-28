import { CreditsQueuesService } from './credits-queues.service';

describe('CreditsQueuesService.listSummary', () => {
  const executeQuery = jest.fn();
  const service = new CreditsQueuesService({ executeQuery } as never);

  beforeEach(() => {
    executeQuery.mockReset();
  });

  it('queries users.agent and users.business object relations', async () => {
    executeQuery.mockResolvedValue({ user_credits: [] });

    await service.listSummary({ limit: 10, offset: 0 });

    const graphql = String(executeQuery.mock.calls[0][0]);
    expect(graphql).toContain('agent { id }');
    expect(graphql).toContain('business { id }');
    expect(graphql).not.toMatch(/\bagents\s*\(/);
    expect(graphql).not.toMatch(/\bbusinesses\s*\(/);
  });

  it('flags agent and business personas from object relations', async () => {
    executeQuery.mockResolvedValue({
      user_credits: [
        {
          user_id: 'user-agent',
          event_type: 'agent_referred',
          weight: 8,
          user: {
            first_name: 'Ada',
            last_name: 'Agent',
            email: 'ada@example.com',
            agent: { id: 'agent-1' },
            business: null,
          },
        },
        {
          user_id: 'user-biz',
          event_type: 'business_referred',
          weight: 15,
          user: {
            first_name: 'Bea',
            last_name: 'Biz',
            email: 'bea@example.com',
            agent: null,
            business: { id: 'biz-1' },
          },
        },
        {
          user_id: 'user-client',
          event_type: 'cancelled_feedback',
          weight: 3,
          user: {
            first_name: 'Cal',
            last_name: 'Client',
            email: 'cal@example.com',
            agent: null,
            business: null,
          },
        },
      ],
    });

    const result = await service.listSummary({ limit: 10, offset: 0 });

    expect(result.total).toBe(3);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 'user-agent',
          is_agent: true,
          is_business: false,
          total_weight: 8,
        }),
        expect.objectContaining({
          user_id: 'user-biz',
          is_agent: false,
          is_business: true,
          total_weight: 15,
        }),
        expect.objectContaining({
          user_id: 'user-client',
          is_agent: false,
          is_business: false,
          total_weight: 3,
        }),
      ])
    );
  });
});
