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
  return { service, accounts };
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
});
