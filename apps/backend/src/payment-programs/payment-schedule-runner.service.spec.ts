import { PaymentScheduleRunnerService } from './payment-schedule-runner.service';

const assignment = {
  id: 'a1',
  amount: 1000,
  currency: 'XAF',
  starts_at: '2026-01-01T00:00:00.000Z',
  ends_at: null,
  schedule: { name: 'Stipend', frequency: 'weekly' },
  agent: { user_id: 'u1', user: { preferred_language: 'en' } },
};

function runner(hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock }) {
  const accounts = { registerTransaction: jest.fn() };
  const notifications = { sendPaymentProgramNotice: jest.fn() };
  const service = new PaymentScheduleRunnerService(
    hasura as never,
    accounts as never,
    notifications as never
  );
  return { service, accounts, notifications };
}

function dueHasura(overrides?: { agentAccount?: { id: string } | null }) {
  return {
    executeQuery: jest.fn(async (query: string) => {
      if (query.includes('DueScheduleAssignments')) {
        return { payment_schedule_assignments: [assignment] };
      }
      if (query.includes('ScheduleRunExists')) {
        return { payment_schedule_runs: [] };
      }
      if (query.includes('HqAccount')) {
        return { users: [{ accounts: [{ id: 'hq-1' }] }] };
      }
      if (query.includes('AgentPersonalAccount')) {
        const account = overrides && 'agentAccount' in overrides ? overrides.agentAccount : { id: 'agent-acct' };
        return { accounts: account ? [account] : [] };
      }
      return {};
    }),
    executeMutation: jest.fn(async (mutation: string) => {
      if (mutation.includes('ClaimScheduleRun')) {
        return { insert_payment_schedule_runs_one: { id: 'run-1' } };
      }
      return {};
    }),
  };
}

describe('PaymentScheduleRunnerService', () => {
  it('skips a period that already has a run', async () => {
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('DueScheduleAssignments')) {
          return { payment_schedule_assignments: [assignment] };
        }
        return { payment_schedule_runs: [{ id: 'run-1' }] };
      }),
      executeMutation: jest.fn(),
    };
    const { service, accounts } = runner(hasura);
    const result = await service.runDue();
    expect(result.skipped).toBe(1);
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
  });

  it('does not credit the agent when the claim loses a race', async () => {
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('DueScheduleAssignments')) {
          return { payment_schedule_assignments: [assignment] };
        }
        return { payment_schedule_runs: [] };
      }),
      executeMutation: jest.fn(async () => {
        throw new Error('unique violation');
      }),
    };
    const { service, accounts } = runner(hasura);
    const result = await service.runDue();
    expect(result.skipped).toBe(1);
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
  });

  it('reverses the HQ debit when the agent wallet credit fails', async () => {
    const hasura = dueHasura({ agentAccount: null });
    const { service, accounts } = runner(hasura);
    accounts.registerTransaction
      .mockResolvedValueOnce({ success: true, transactionId: 'hq-tx' })
      .mockResolvedValueOnce({ success: true, transactionId: 'rev-tx' });

    const result = await service.runDue();

    expect(result.failures).toBe(1);
    expect(accounts.registerTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        accountId: 'hq-1',
        amount: 1000,
        transactionType: 'payment',
        allowNegative: true,
      })
    );
    expect(accounts.registerTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        accountId: 'hq-1',
        amount: 1000,
        transactionType: 'deposit',
        memo: expect.stringContaining('reversal'),
      })
    );
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpdateScheduleRun'),
      expect.objectContaining({ id: 'run-1', status: 'failed', reason: 'Agent wallet missing' })
    );
  });

  it('marks the run posted with HQ and agent transaction ids on success', async () => {
    const hasura = dueHasura();
    const { service, accounts, notifications } = runner(hasura);
    accounts.registerTransaction
      .mockResolvedValueOnce({ success: true, transactionId: 'hq-tx' })
      .mockResolvedValueOnce({ success: true, transactionId: 'agent-tx' });

    const result = await service.runDue();

    expect(result.credited).toBe(1);
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('UpdateScheduleRun'),
      expect.objectContaining({
        id: 'run-1',
        status: 'posted',
        reason: null,
        hqId: 'hq-tx',
        agentId: 'agent-tx',
      })
    );
    expect(notifications.sendPaymentProgramNotice).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', messageType: 'PAYMENT_SCHEDULE' })
    );
  });
});
