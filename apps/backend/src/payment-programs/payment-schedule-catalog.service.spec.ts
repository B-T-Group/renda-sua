import { BadRequestException } from '@nestjs/common';
import {
  PaymentScheduleCatalogService,
  canResumeAssignment,
  canTransitionAssignment,
} from './payment-schedule-catalog.service';

function catalog(
  hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock },
  consent?: { notifyAgentOfOffer: jest.Mock }
) {
  return new PaymentScheduleCatalogService(
    hasura as never,
    (consent ?? { notifyAgentOfOffer: jest.fn() }) as never
  );
}

describe('canResumeAssignment', () => {
  it('returns false when the schedule is inactive or ends_at is past', () => {
    expect(canResumeAssignment(false, null)).toBe(false);
    expect(canResumeAssignment(true, '2020-01-01T00:00:00.000Z', Date.parse('2026-01-01'))).toBe(
      false
    );
    expect(canResumeAssignment(true, null)).toBe(true);
    expect(canResumeAssignment(true, '2026-06-01T00:00:00.000Z', Date.parse('2026-01-01'))).toBe(
      true
    );
  });
});

describe('canTransitionAssignment', () => {
  it('allows only active/paused transitions and blocks ended resumes', () => {
    expect(canTransitionAssignment('active', 'paused')).toBe(true);
    expect(canTransitionAssignment('paused', 'active')).toBe(true);
    expect(canTransitionAssignment('ended', 'active')).toBe(false);
    expect(canTransitionAssignment('ended', 'paused')).toBe(false);
    expect(canTransitionAssignment('active', 'active')).toBe(true);
  });
});

describe('PaymentScheduleCatalogService.assign', () => {
  it('rejects assign when the agent already has an open assignment', async () => {
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('ScheduleById')) {
          return {
            payment_schedules_by_pk: {
              id: 's1',
              is_active: true,
              currency: 'XAF',
              default_amount: 1000,
              default_duration_days: 30,
            },
          };
        }
        return { payment_schedule_assignments: [{ id: 'existing' }] };
      }),
      executeMutation: jest.fn(),
    };

    await expect(
      catalog(hasura).assign({
        scheduleId: 's1',
        agentId: 'agent-1',
        startsAt: '2026-01-01T00:00:00.000Z',
      })
    ).rejects.toMatchObject({
      message: 'This agent already has an open assignment for this schedule',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('snapshots objectives and notifies the agent', async () => {
    const consent = { notifyAgentOfOffer: jest.fn() };
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('ScheduleById')) {
          return {
            payment_schedules_by_pk: {
              id: 's1',
              is_active: true,
              currency: 'XAF',
              default_amount: 1500,
              default_duration_days: 30,
              target_agent_recruitments: 2,
              target_item_sales_amount: 50000,
            },
          };
        }
        return { payment_schedule_assignments: [] };
      }),
      executeMutation: jest.fn(async () => ({
        insert_payment_schedule_assignments_one: { id: 'a1' },
      })),
    };

    await expect(
      catalog(hasura, consent).assign({
        scheduleId: 's1',
        agentId: 'agent-1',
        startsAt: '2026-01-01T00:00:00.000Z',
      })
    ).resolves.toEqual({ id: 'a1' });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertAssignment'),
      {
        object: expect.objectContaining({
          schedule_id: 's1',
          agent_id: 'agent-1',
          amount: 1500,
          currency: 'XAF',
          starts_at: '2026-01-01T00:00:00.000Z',
          ends_at: '2026-01-31T00:00:00.000Z',
          status: 'pending_acceptance',
          decision: 'pending',
          target_agent_recruitments: 2,
          target_item_sales_amount: 50000,
        }),
      }
    );
    expect(consent.notifyAgentOfOffer).toHaveBeenCalledWith('a1');
  });
});

describe('PaymentScheduleCatalogService.setAssignmentStatus', () => {
  it('rejects ended → active transitions', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: {
          id: 'a1',
          status: 'ended',
          decision: 'accepted',
          schedule_id: 's1',
          agent_id: 'agent-1',
          ends_at: null,
          schedule: { is_active: true },
        },
      })),
      executeMutation: jest.fn(),
    };

    await expect(catalog(hasura).setAssignmentStatus('a1', 'active')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects resume after ends_at has passed', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: {
          id: 'a1',
          status: 'paused',
          decision: 'accepted',
          schedule_id: 's1',
          agent_id: 'agent-1',
          ends_at: '2020-01-01T00:00:00.000Z',
          schedule: { is_active: true },
        },
      })),
      executeMutation: jest.fn(),
    };

    await expect(catalog(hasura).setAssignmentStatus('a1', 'active')).rejects.toMatchObject({
      message: 'Assignment cannot resume',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });
});

describe('PaymentScheduleCatalogService.updateAssignment', () => {
  it('rejects amount updates on an ended assignment', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: {
          id: 'a1',
          status: 'ended',
          decision: 'accepted',
        },
      })),
      executeMutation: jest.fn(),
    };

    await expect(catalog(hasura).updateAssignment('a1', { amount: 2000 })).rejects.toMatchObject({
      message:
        'Assignment can only change while active, paused, or awaiting a response',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });
});
