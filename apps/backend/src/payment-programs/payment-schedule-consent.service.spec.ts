import { BadRequestException } from '@nestjs/common';
import { PaymentScheduleConsentService } from './payment-schedule-consent.service';

function service(deps: {
  hasura?: { executeQuery: jest.Mock; executeMutation: jest.Mock };
  progress?: { compute: jest.Mock };
  notifications?: {
    sendPaymentProgramNotice: jest.Mock;
    notifySuperusersPaymentScheduleDecision: jest.Mock;
  };
}) {
  return new PaymentScheduleConsentService(
    (deps.hasura ?? {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    }) as never,
    (deps.progress ?? { compute: jest.fn(async () => ({ completionPercent: null })) }) as never,
    (deps.notifications ?? {
      sendPaymentProgramNotice: jest.fn(),
      notifySuperusersPaymentScheduleDecision: jest.fn(),
    }) as never
  );
}

const openRow = {
  id: 'a1',
  agent_id: 'agent-1',
  amount: 1000,
  currency: 'XAF',
  starts_at: '2026-01-01T00:00:00.000Z',
  ends_at: null,
  status: 'pending_acceptance',
  decision: 'pending',
  accepted_at: null,
  schedule: { id: 's1', name: 'Starter', frequency: 'weekly' },
  agent: {
    user_id: 'user-1',
    user: { first_name: 'Ada', last_name: 'Agent', email: 'a@example.com' },
  },
  runs: [],
};

describe('PaymentScheduleConsentService', () => {
  it('rejects accept when the offer is no longer pending_acceptance', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: {
          ...openRow,
          status: 'ended',
          decision: 'pending',
        },
      })),
      executeMutation: jest.fn(),
    };
    await expect(service({ hasura }).accept('a1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects when other is missing a note', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: openRow,
      })),
      executeMutation: jest.fn(),
    };
    await expect(
      service({ hasura }).reject('a1', 'user-1', 'other', '  ')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('accepts an open offer and notifies superusers', async () => {
    const notifications = {
      sendPaymentProgramNotice: jest.fn(),
      notifySuperusersPaymentScheduleDecision: jest.fn(),
    };
    const acceptedRow = {
      ...openRow,
      decision: 'accepted',
      status: 'active',
      accepted_at: '2026-01-02T00:00:00.000Z',
    };
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(async () => ({})),
    };
    hasura.executeQuery
      .mockResolvedValueOnce({ payment_schedule_assignments_by_pk: openRow })
      .mockResolvedValueOnce({ payment_schedule_assignments: [] })
      .mockResolvedValue({ payment_schedule_assignments_by_pk: acceptedRow });

    const result = await service({ hasura, notifications }).accept('a1', 'user-1');
    expect(result.decision).toBe('accepted');
    expect(notifications.notifySuperusersPaymentScheduleDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'accepted', assignmentId: 'a1' })
    );
  });
});
