import { CREDIT_WEIGHTS } from './credit-weights';
import { CreditsService } from './credits.service';

describe('CreditsService', () => {
  let executeQuery: jest.Mock;
  let executeMutation: jest.Mock;
  let service: CreditsService;

  beforeEach(() => {
    executeQuery = jest.fn();
    executeMutation = jest.fn();
    service = new CreditsService({ executeQuery, executeMutation } as any);
  });

  it('inserts cancelled feedback with the snapshotted weight and trimmed notes', async () => {
    executeMutation.mockResolvedValue({
      insert_user_credits_one: { id: 'c1' },
    });

    await expect(
      service.awardCancelledFeedback({
        userId: 'ops-1',
        orderId: 'order-1',
        notes: '  called the shop  ',
        contactChannel: 'call',
      })
    ).resolves.toEqual({ id: 'c1' });

    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertUserCredit'),
      {
        object: expect.objectContaining({
          user_id: 'ops-1',
          event_type: 'cancelled_feedback',
          weight: CREDIT_WEIGHTS.cancelled_feedback,
          order_id: 'order-1',
          notes: 'called the shop',
          contact_channel: 'call',
          created_by: 'ops-1',
        }),
      }
    );
  });

  it('treats unique-constraint races as already credited', async () => {
    executeMutation.mockRejectedValue(new Error('Uniqueness violation'));
    await expect(
      service.award({
        userId: 'ops-1',
        eventType: 'cancelled_feedback',
        orderId: 'order-1',
      })
    ).resolves.toBeNull();
  });

  it('swallows non-unique insert failures instead of throwing', async () => {
    executeMutation.mockRejectedValue(new Error('Hasura 503'));
    await expect(
      service.award({
        userId: 'ops-1',
        eventType: 'escalation_resolved',
        orderId: 'order-1',
      })
    ).resolves.toBeNull();
  });

  it('classifies only unclassified orders and records the ops event', async () => {
    executeMutation
      .mockResolvedValueOnce({ update_orders: { affected_rows: 1 } })
      .mockResolvedValueOnce({ insert_order_events_one: { id: 'e1' } });

    await expect(
      service.classifyOrderForOps({
        orderId: 'order-1',
        classification: 'test',
        actorId: 'ops-1',
        notes: '  qa cart  ',
      })
    ).resolves.toBe(true);

    expect(executeMutation.mock.calls[0][0]).toContain(
      'ops_classification: { _is_null: true }'
    );
    expect(executeMutation.mock.calls[0][1]).toEqual({
      id: 'order-1',
      classification: 'test',
    });
    expect(executeMutation.mock.calls[1][1]).toEqual({
      orderId: 'order-1',
      actorId: 'ops-1',
      payload: {
        action: 'ops_classified',
        classification: 'test',
        note: 'qa cart',
      },
    });
  });

  it('does not write an event when the order was already classified', async () => {
    executeMutation.mockResolvedValue({ update_orders: { affected_rows: 0 } });
    await expect(
      service.classifyOrderForOps({
        orderId: 'order-1',
        classification: 'internal',
        actorId: 'ops-1',
        notes: 'staff',
      })
    ).resolves.toBe(false);
    expect(executeMutation).toHaveBeenCalledTimes(1);
  });

  it('resolves an open incident and records the audit event', async () => {
    executeMutation
      .mockResolvedValueOnce({
        update_order_risk_incidents: {
          returning: [
            { id: 'inc-1', order_id: 'order-1', resolved_at: 'now' },
          ],
        },
      })
      .mockResolvedValueOnce({ insert_order_events_one: { id: 'e1' } });

    const incident = await service.resolveIncidentForCredit({
      incidentId: 'inc-1',
      userId: 'ops-1',
      note: '  reached client  ',
      contactChannel: 'call',
      orderResult: 'confirmed',
    });

    expect(incident).toEqual({
      id: 'inc-1',
      order_id: 'order-1',
      resolved_at: 'now',
    });
    expect(executeMutation.mock.calls[0][1].set).toEqual(
      expect.objectContaining({
        acknowledged_by: 'ops-1',
        acknowledged_note: 'reached client',
        resolution: 'acknowledged_resolved',
        resolved_by: 'ops-1',
        contact_channel: 'call',
        order_result: 'confirmed',
      })
    );
    expect(executeMutation.mock.calls[0][0]).toContain(
      'resolved_at: { _is_null: true }'
    );
    expect(executeMutation.mock.calls[1][1].payload).toEqual({
      incidentId: 'inc-1',
      note: 'reached client',
      contact_channel: 'call',
      order_result: 'confirmed',
    });
  });

  it('returns the existing incident when it is already resolved', async () => {
    executeMutation.mockResolvedValue({
      update_order_risk_incidents: { returning: [] },
    });
    executeQuery.mockResolvedValue({
      order_risk_incidents_by_pk: {
        id: 'inc-1',
        order_id: 'order-1',
        resolved_at: 'already',
      },
    });

    await expect(
      service.resolveIncidentForCredit({
        incidentId: 'inc-1',
        userId: 'ops-1',
        note: 'retry',
        contactChannel: 'email',
        orderResult: 'order_cancelled',
      })
    ).resolves.toEqual({
      id: 'inc-1',
      order_id: 'order-1',
      resolved_at: 'already',
    });
    expect(executeMutation).toHaveBeenCalledTimes(1);
  });

  it('resolves a business referrer from the payload and an agent via Hasura', async () => {
    executeQuery.mockResolvedValue({
      agents_by_pk: { user_id: 'agent-user' },
    });

    await expect(
      service.resolveReferrerUserId({
        kind: 'business',
        businessUserId: 'biz-user',
      })
    ).resolves.toBe('biz-user');
    await expect(
      service.resolveReferrerUserId({ kind: 'agent' })
    ).resolves.toBeNull();
    await expect(
      service.resolveReferrerUserId({ kind: 'agent', agentId: 'ag-1' })
    ).resolves.toBe('agent-user');
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });
});
