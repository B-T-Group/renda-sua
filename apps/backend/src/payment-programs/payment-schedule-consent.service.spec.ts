import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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

  it('forbids an agent from deciding another agent offer', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: {
          ...openRow,
          agent: { ...openRow.agent, user_id: 'someone-else' },
        },
      })),
      executeMutation: jest.fn(),
    };
    await expect(service({ hasura }).accept('a1', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('returns not found when the assignment is missing', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: null,
      })),
      executeMutation: jest.fn(),
    };
    await expect(service({ hasura }).defer('missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('blocks accept when another open assignment already exists', async () => {
    const hasura = {
      executeQuery: jest
        .fn()
        .mockResolvedValueOnce({ payment_schedule_assignments_by_pk: openRow })
        .mockResolvedValueOnce({
          payment_schedule_assignments: [{ id: 'other' }],
        }),
      executeMutation: jest.fn(),
    };
    await expect(service({ hasura }).accept('a1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('blocks accept when the schedule id is missing', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: {
          ...openRow,
          schedule: { name: 'Starter' },
        },
      })),
      executeMutation: jest.fn(),
    };
    await expect(service({ hasura }).accept('a1', 'user-1')).rejects.toThrow(
      /schedule is missing/i
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('refuses a second response after the decision is no longer open', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: { ...openRow, decision: 'accepted' },
      })),
      executeMutation: jest.fn(),
    };
    await expect(
      service({ hasura }).reject('a1', 'user-1', 'too_aggressive')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('lets a deferred offer be accepted when no other assignment is open', async () => {
    const deferred = { ...openRow, decision: 'deferred' };
    const acceptedRow = {
      ...deferred,
      decision: 'accepted',
      status: 'active',
      accepted_at: '2026-01-02T00:00:00.000Z',
    };
    const notifications = {
      sendPaymentProgramNotice: jest.fn(),
      notifySuperusersPaymentScheduleDecision: jest.fn(),
    };
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(async () => ({})),
    };
    hasura.executeQuery
      .mockResolvedValueOnce({ payment_schedule_assignments_by_pk: deferred })
      .mockResolvedValueOnce({ payment_schedule_assignments: [] })
      .mockResolvedValue({ payment_schedule_assignments_by_pk: acceptedRow });

    const result = await service({ hasura, notifications }).accept('a1', 'user-1');
    expect(result.decision).toBe('accepted');
    const update = hasura.executeMutation.mock.calls.find(([query]) =>
      String(query).includes('UpdateAssignmentDecision')
    );
    expect(update?.[1].set).toEqual(
      expect.objectContaining({ decision: 'accepted', status: 'active' })
    );
    expect(update?.[1].set.accepted_at).toEqual(expect.any(String));
  });

  it('defers an open offer without activating it', async () => {
    const deferredRow = { ...openRow, decision: 'deferred' };
    const hasura = {
      executeQuery: jest
        .fn()
        .mockResolvedValueOnce({ payment_schedule_assignments_by_pk: openRow })
        .mockResolvedValue({ payment_schedule_assignments_by_pk: deferredRow }),
      executeMutation: jest.fn(async () => ({})),
    };
    const result = await service({ hasura }).defer('a1', 'user-1');
    expect(result.decision).toBe('deferred');
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpdateAssignmentDecision'),
      {
        id: 'a1',
        set: { decision: 'deferred', status: 'pending_acceptance' },
      }
    );
  });

  it('persists a trimmed reject note for a known reason', async () => {
    const rejectedRow = {
      ...openRow,
      decision: 'rejected',
      status: 'rejected',
      reject_reason: 'too_aggressive',
      reject_note: 'later',
    };
    const notifications = {
      sendPaymentProgramNotice: jest.fn(),
      notifySuperusersPaymentScheduleDecision: jest.fn(),
    };
    const hasura = {
      executeQuery: jest
        .fn()
        .mockResolvedValueOnce({ payment_schedule_assignments_by_pk: openRow })
        .mockResolvedValue({ payment_schedule_assignments_by_pk: rejectedRow }),
      executeMutation: jest.fn(async () => ({})),
    };
    await service({ hasura, notifications }).reject(
      'a1',
      'user-1',
      'too_aggressive',
      '  later  '
    );
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpdateAssignmentDecision'),
      expect.objectContaining({
        set: expect.objectContaining({
          decision: 'rejected',
          status: 'rejected',
          reject_reason: 'too_aggressive',
          reject_note: 'later',
        }),
      })
    );
    expect(notifications.notifySuperusersPaymentScheduleDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'rejected',
        reason: 'too_aggressive',
        note: 'later',
      })
    );
  });

  it('does not notify when the offer has no agent user', async () => {
    const notifications = {
      sendPaymentProgramNotice: jest.fn(),
      notifySuperusersPaymentScheduleDecision: jest.fn(),
    };
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments_by_pk: { ...openRow, agent: {} },
      })),
      executeMutation: jest.fn(),
    };
    await service({ hasura, notifications }).notifyAgentOfOffer('a1');
    expect(notifications.sendPaymentProgramNotice).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('lists pending offers and falls back when the schedule name is missing', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        payment_schedule_assignments: [
          { id: 'a1', schedule: { name: 'Starter' } },
          { id: 'a2' },
        ],
      })),
      executeMutation: jest.fn(),
    };
    await expect(service({ hasura }).listPendingForAgentUser('user-1')).resolves.toEqual([
      { id: 'a1', scheduleName: 'Starter' },
      { id: 'a2', scheduleName: 'Payment schedule' },
    ]);
  });
});
