import { CREDIT_WEIGHTS } from './credit-weights';
import { CreditsQueuesService } from './credits-queues.service';
import type { CreditEventType, CreditsFeedbackOrderRow } from './credit.types';

describe('CreditsQueuesService', () => {
  let executeQuery: jest.Mock;
  let service: CreditsQueuesService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-29T12:00:00.000Z'));
    executeQuery = jest.fn();
    service = new CreditsQueuesService({ executeQuery } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cuts the feedback window at 14 days', () => {
    expect(service.feedbackCutoffIso()).toBe('2026-08-15T12:00:00.000Z');
  });

  it('keeps stamps on or after the cutoff and rejects missing dates', async () => {
    await expect(
      service.isWithinFeedbackWindow('2026-08-15T12:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      service.isWithinFeedbackWindow('2026-08-15T11:59:59.000Z')
    ).resolves.toBe(false);
    await expect(service.isWithinFeedbackWindow(null)).resolves.toBe(false);
  });

  it('excludes classified and already-credited cancelled orders and filters by ISO country', async () => {
    executeQuery.mockResolvedValue({
      orders: [],
      orders_aggregate: { aggregate: { count: 0 } },
    });

    await service.listCancelledWithoutFeedback({
      limit: 20,
      offset: 5,
      country: ' cm ',
    });

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('CreditOrdersQueue'),
      {
        where: {
          current_status: { _eq: 'cancelled' },
          cancelled_at: { _gte: '2026-08-15T12:00:00.000Z' },
          ops_classification: { _is_null: true },
          _not: {
            user_credits: { event_type: { _eq: 'cancelled_feedback' } },
          },
          client: { user: { country: { _eq: 'CM' } } },
        },
        limit: 20,
        offset: 5,
      }
    );
  });

  it('ignores invalid country codes on cancelled and escalation queues', async () => {
    executeQuery.mockResolvedValue({
      orders: [],
      orders_aggregate: { aggregate: { count: 0 } },
      order_risk_incidents: [],
      order_risk_incidents_aggregate: { aggregate: { count: 0 } },
    });

    await service.listCancelledWithoutFeedback({
      limit: 10,
      offset: 0,
      country: 'cameroon',
    });
    expect(executeQuery.mock.calls[0][1].where.client).toBeUndefined();

    await service.listOpenEscalations({
      limit: 10,
      offset: 0,
      country: 'C',
    });
    expect(executeQuery.mock.calls[1][1].where).toEqual({
      resolved_at: { _is_null: true },
    });
  });

  it('scopes open escalations to the client country via the nested order', async () => {
    executeQuery.mockResolvedValue({
      order_risk_incidents: [],
      order_risk_incidents_aggregate: { aggregate: { count: 0 } },
    });

    await service.listOpenEscalations({
      limit: 15,
      offset: 3,
      country: 'ca',
    });

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('OpenEscalations'),
      {
        where: {
          resolved_at: { _is_null: true },
          order: { client: { user: { country: { _eq: 'CA' } } } },
        },
        limit: 15,
        offset: 3,
      }
    );
  });

  it('prefers the variant photo, then the parent display URL', async () => {
    executeQuery.mockResolvedValue({
      orders: [
        {
          id: 'o1',
          order_number: '100',
          current_status: 'cancelled',
          order_items: [
            {
              item_name: 'Shirt',
              quantity: 2,
              variant_name: 'Red',
              item: {
                item_images: [
                  {
                    image_url: 'parent.jpg',
                    display_url: 'parent-display.jpg',
                  },
                ],
              },
              item_variant: {
                item_variant_images: [{ image_url: 'variant.jpg' }],
              },
            },
            {
              item_name: 'Hat',
              quantity: 1,
              variant_name: null,
              item: {
                item_images: [
                  { image_url: 'hat.jpg', display_url: null },
                ],
              },
              item_variant: { item_variant_images: [] },
            },
          ],
        },
      ],
      orders_aggregate: { aggregate: { count: 1 } },
    });

    const result = await service.listCancelledWithoutFeedback({
      limit: 10,
      offset: 0,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].order_items).toEqual([
      {
        item_name: 'Shirt',
        quantity: 2,
        variant_name: 'Red',
        image_url: 'variant.jpg',
      },
      {
        item_name: 'Hat',
        quantity: 1,
        variant_name: null,
        image_url: 'hat.jpg',
      },
    ]);
  });

  it('keeps only each client first completed order and paginates after the filter', async () => {
    const row = (
      id: string,
      clientId: string
    ): CreditsFeedbackOrderRow => ({
      id,
      order_number: id,
      current_status: 'complete',
      client_id: clientId,
    });
    executeQuery
      .mockResolvedValueOnce({
        orders: [
          row('first-a', 'client-a'),
          row('later-a', 'client-a'),
          row('not-first-b', 'client-b'),
          row('first-c', 'client-c'),
        ],
      })
      .mockResolvedValueOnce({ orders: [{ id: 'first-a' }] })
      .mockResolvedValueOnce({ orders: [{ id: 'older-b' }] })
      .mockResolvedValueOnce({ orders: [{ id: 'first-c' }] });

    const page = await service.listFirstOrderWithoutFeedback({
      limit: 1,
      offset: 1,
      country: 'GA',
    });

    expect(executeQuery.mock.calls[0][1]).toEqual({
      where: {
        current_status: { _eq: 'complete' },
        completed_at: { _gte: '2026-08-15T12:00:00.000Z' },
        ops_classification: { _is_null: true },
        _not: {
          user_credits: {
            event_type: { _eq: 'first_order_completed_feedback' },
          },
        },
        client: { user: { country: { _eq: 'GA' } } },
      },
      limit: 5000,
    });
    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.id)).toEqual(['first-c']);
  });

  it('queries users.agent and users.business and ranks the summary by weight', async () => {
    executeQuery.mockResolvedValue({
      user_credits: [
        {
          user_id: 'u-low',
          event_type: 'my_first_purchase' as CreditEventType,
          weight: 1,
          user: {
            first_name: 'Low',
            last_name: 'Score',
            email: 'low@x.com',
            country: 'CM',
            agent: null,
            business: { id: 'b1' },
          },
        },
        {
          user_id: 'u-high',
          event_type: 'cancelled_feedback' as CreditEventType,
          weight: 3,
          user: {
            first_name: 'High',
            last_name: 'Score',
            email: 'high@x.com',
            country: 'CM',
            agent: { id: 'a1' },
            business: null,
          },
        },
        {
          user_id: 'u-high',
          event_type: 'escalation_resolved' as CreditEventType,
          weight: 5,
          user: {
            first_name: 'High',
            last_name: 'Score',
            email: 'high@x.com',
            country: 'CM',
            agent: { id: 'a1' },
            business: null,
          },
        },
      ],
    });

    const result = await service.listSummary({
      limit: 1,
      offset: 0,
      eventType: 'cancelled_feedback',
      country: 'cm',
    });

    const query = String(executeQuery.mock.calls[0][0]);
    expect(query).toMatch(/agent\s*\{\s*id\s*\}/);
    expect(query).toMatch(/business\s*\{\s*id\s*\}/);
    expect(query).not.toMatch(/users\.agents|agents\s*\{/);
    expect(executeQuery.mock.calls[0][1].where).toEqual({
      _and: [
        { event_type: { _eq: 'cancelled_feedback' } },
        { user: { country: { _eq: 'CM' } } },
      ],
    });
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      user_id: 'u-high',
      total_weight: 8,
      credit_count: 2,
      is_agent: true,
      is_business: false,
      by_event: {
        cancelled_feedback: { count: 1, weight: 3 },
        escalation_resolved: { count: 1, weight: 5 },
      },
    });
    expect(result.weights).toEqual(CREDIT_WEIGHTS);
  });

  it('combines ledger filters and coerces pagination to numbers', async () => {
    executeQuery.mockResolvedValue({
      user_credits: [],
      user_credits_aggregate: { aggregate: { count: 0 } },
    });

    await service.listCredits({
      limit: '25' as unknown as number,
      offset: '10' as unknown as number,
      userId: 'user-1',
      eventType: 'business_referred',
      country: 'US',
    });

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('ListUserCredits'),
      {
        where: {
          _and: [
            { user_id: { _eq: 'user-1' } },
            { event_type: { _eq: 'business_referred' } },
            { user: { country: { _eq: 'US' } } },
          ],
        },
        limit: 25,
        offset: 10,
      }
    );
  });

  it('maps feedback-order party ids and treats the earliest completion as first', async () => {
    executeQuery
      .mockResolvedValueOnce({
        orders_by_pk: {
          id: 'o1',
          current_status: 'cancelled',
          cancelled_at: '2026-08-20T00:00:00.000Z',
          completed_at: null,
          updated_at: '2026-08-20T00:00:00.000Z',
          client_id: 'client-row',
          ops_classification: null,
          client: { user_id: 'client-user' },
          business: { user_id: 'biz-user' },
        },
      })
      .mockResolvedValueOnce({ orders: [{ id: 'o9' }] });

    await expect(service.getOrderForFeedback('o1')).resolves.toEqual({
      id: 'o1',
      current_status: 'cancelled',
      cancelled_at: '2026-08-20T00:00:00.000Z',
      completed_at: null,
      updated_at: '2026-08-20T00:00:00.000Z',
      client_id: 'client-row',
      ops_classification: null,
      client_user_id: 'client-user',
      business_user_id: 'biz-user',
    });
    await expect(
      service.isClientFirstCompletedOrder('client-row', 'o9')
    ).resolves.toBe(true);
    expect(executeQuery.mock.calls[1][1]).toEqual({ clientId: 'client-row' });
  });
});
