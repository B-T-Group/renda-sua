import { BadRequestException } from '@nestjs/common';
import { CashAdvanceService } from './cash-advance.service';

const USER_ID = 'user-1';
const CURRENCY = 'XAF';

function facility(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fac-1',
    limit_amount: 10000,
    ends_at: null,
    program: { name: 'Advance' },
    account: { id: 'acct-1', cash_advance_balance: -2500 },
    user: { preferred_language: 'en' },
    ...overrides,
  };
}

function service(hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock }) {
  const accounts = { registerTransaction: jest.fn() };
  const notifications = { sendPaymentProgramNotice: jest.fn() };
  return {
    service: new CashAdvanceService(hasura as never, accounts as never, notifications as never),
    accounts,
    notifications,
  };
}

describe('CashAdvanceService.draw', () => {
  it('rejects a draw above drawableRemaining', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({ cash_advance_facilities: [facility()] })),
      executeMutation: jest.fn(),
    };
    const { service: cashAdvance, accounts } = service(hasura);

    await expect(cashAdvance.draw(USER_ID, 8000, CURRENCY)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects draw when facility ends_at is in the past', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        cash_advance_facilities: [facility({ ends_at: '2020-01-01T00:00:00.000Z' })],
      })),
      executeMutation: jest.fn(),
    };
    const { service: cashAdvance, accounts } = service(hasura);

    await expect(cashAdvance.draw(USER_ID, 1000, CURRENCY)).rejects.toMatchObject({
      message: 'Cash-advance facility has ended',
    });
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
  });

  it('rejects draw when no active facility exists', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({ cash_advance_facilities: [] })),
      executeMutation: jest.fn(),
    };
    const { service: cashAdvance, accounts } = service(hasura);

    await expect(cashAdvance.draw(USER_ID, 1000, CURRENCY)).rejects.toMatchObject({
      message: 'No active cash-advance facility',
    });
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
  });

  it('credits the wallet then inserts a draw row on success', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({ cash_advance_facilities: [facility()] })),
      executeMutation: jest.fn(async () => ({ insert_cash_advance_draws_one: { id: 'd1' } })),
    };
    const { service: cashAdvance, accounts, notifications } = service(hasura);
    accounts.registerTransaction.mockResolvedValue({
      success: true,
      transactionId: 'tx-1',
      newBalance: { cashAdvance: -3500 },
    });

    await expect(cashAdvance.draw(USER_ID, 1000, CURRENCY)).resolves.toEqual({
      transactionId: 'tx-1',
      newBalance: { cashAdvance: -3500 },
    });
    expect(accounts.registerTransaction).toHaveBeenCalledWith({
      accountId: 'acct-1',
      amount: 1000,
      transactionType: 'cash_advance',
      memo: 'Cash advance draw - Advance',
    });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertDraw'),
      { object: { facility_id: 'fac-1', amount: 1000, transaction_id: 'tx-1' } }
    );
    expect(notifications.sendPaymentProgramNotice).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, messageType: 'CASH_ADVANCE_DRAW' })
    );
  });

  it('does not insert a draw when registerTransaction fails', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({ cash_advance_facilities: [facility()] })),
      executeMutation: jest.fn(),
    };
    const { service: cashAdvance, accounts, notifications } = service(hasura);
    accounts.registerTransaction.mockResolvedValue({ success: false, error: 'Ledger rejected' });

    await expect(cashAdvance.draw(USER_ID, 1000, CURRENCY)).rejects.toMatchObject({
      message: 'Ledger rejected',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendPaymentProgramNotice).not.toHaveBeenCalled();
  });
});

describe('CashAdvanceService.openFacility', () => {
  it('rejects opening a facility on an inactive program', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        cash_advance_programs_by_pk: { id: 'p1', is_active: false },
      })),
      executeMutation: jest.fn(),
    };
    const { service: cashAdvance } = service(hasura);

    await expect(
      cashAdvance.openFacility({
        programId: 'p1',
        programName: 'Advance',
        userId: USER_ID,
        currency: CURRENCY,
        limitAmount: 5000,
      })
    ).rejects.toMatchObject({ message: 'Cash-advance program is not active' });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });
});
