import { HttpException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { RentalsService } from './rentals.service';
import { assertLedgerResult, rentalLedgerKey } from './rental-ledger';
import {
  decideRentalMomoRetry,
  newRentalMomoReference,
  RENTAL_MOMO_PENDING_MAX_AGE_MS,
} from './rental-momo-idempotency';

describe('rental ledger keys', () => {
  it('builds a stable key and rejects a failed ledger write', () => {
    expect(rentalLedgerKey('b1', 'hold:release')).toBe('rental:b1:hold:release');
    expect(() =>
      assertLedgerResult({ success: false, error: 'short' }, 'hold release')
    ).toThrow(HttpException);
    expect(() => assertLedgerResult({ success: true }, 'hold')).not.toThrow();
  });

  it('gives each mobile-money attempt its own reference and replaces a stale prompt', () => {
    const first = newRentalMomoReference('contract', 1_700_000_000_000);
    const second = newRentalMomoReference('contract', 1_700_000_000_001);
    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(15);
    expect(second.startsWith('c')).toBe(true);
    const fresh = new Date().toISOString();
    const stale = new Date(Date.now() - RENTAL_MOMO_PENDING_MAX_AGE_MS - 1000).toISOString();
    expect(
      decideRentalMomoRetry({ status: 'pending', transaction_id: 'p', created_at: fresh })
    ).toBe('skip');
    expect(
      decideRentalMomoRetry({ status: 'pending', transaction_id: 'p', created_at: stale })
    ).toBe('replace');
    expect(decideRentalMomoRetry({ status: 'failed', transaction_id: null })).toBe(
      'replace'
    );
  });
});

describe('rental ledger moves', () => {
  const svc: any = Object.create(RentalsService.prototype);

  it('does not mark the hold released when the release ledger fails', async () => {
    svc.getHold = jest.fn().mockResolvedValue({
      status: 'active',
      client_hold_amount: 20,
      ledger_attempt_id: 'attempt-1',
    });
    svc.hasuraSystemService = {
      getAccount: jest.fn().mockResolvedValue({ id: 'acc' }),
      executeMutation: jest.fn(),
    };
    svc.accountsService = {
      registerReleaseIfNotExists: jest
        .fn()
        .mockResolvedValue({ success: false, error: 'release failed' }),
    };
    await expect(
      svc.releaseHoldIfNeeded('b1', {
        client: { user_id: 'u' },
        currency: 'XAF',
      })
    ).rejects.toThrow('release failed');
    expect(svc.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(
      svc.accountsService.registerReleaseIfNotExists
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'rental:b1:hold:attempt-1:release',
        referenceId: 'attempt-1',
      })
    );
  });

  it('stops overtime proceeds when the client debit fails', async () => {
    svc.hasuraSystemService = {
      getAccount: jest.fn().mockResolvedValue({ id: 'client-acc' }),
      ensureAccountForBusinessLocation: jest
        .fn()
        .mockResolvedValue({ id: 'biz-acc' }),
    };
    svc.accountsService = {
      registerTransaction: jest
        .fn()
        .mockResolvedValue({ success: false, error: 'short' }),
    };
    await expect(
      svc.registerRentalProceedsLedger(
        {
          id: 'b1',
          currency: 'XAF',
          client: { user_id: 'u' },
          rental_location_listing: { business_location_id: 'loc' },
        },
        40,
        'Overtime'
      )
    ).rejects.toThrow('short');
    expect(svc.accountsService.registerTransaction).toHaveBeenCalledTimes(1);
    expect(svc.accountsService.registerTransaction.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        idempotencyKey: 'rental:b1:overtime:payment',
      })
    );
  });

  it('uses the same hold-release key when settling the contract', async () => {
    svc.getHold = jest.fn().mockResolvedValue({
      status: 'active',
      client_hold_amount: 20,
      ledger_attempt_id: 'attempt-1',
    });
    svc.rentalSettlementAccounts = jest.fn().mockResolvedValue({
      clientAccountId: 'client-acc',
      businessAccountId: 'biz-acc',
    });
    svc.hasuraSystemService = { executeMutation: jest.fn() };
    svc.accountsService = {
      registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      registerTransaction: jest.fn().mockResolvedValue({ success: true }),
    };
    await svc.settleBooking({
      id: 'b1',
      total_amount: 20,
      client: { user_id: 'u' },
    });
    expect(
      svc.accountsService.registerReleaseIfNotExists.mock.calls[0][0]
        .idempotencyKey
    ).toBe('rental:b1:hold:attempt-1:release');
    const keys = svc.accountsService.registerTransaction.mock.calls.map(
      (call: any[]) => call[0].idempotencyKey
    );
    expect(keys).toEqual([
      'rental:b1:contract:payment',
      'rental:b1:contract:proceeds',
    ]);
  });
});

describe('rental hold attempts against the ledger', () => {
  function memoryLedger() {
    const account = {
      id: 'acc',
      user_id: 'client-user',
      currency: 'XAF',
      available_balance: 500,
      withheld_balance: 0,
      cash_advance_balance: 0,
      total_balance: 500,
      is_active: true,
    };
    const txs: Array<{
      id: string;
      account_id: string;
      amount: number;
      transaction_type: string;
      reference_id: string;
      idempotency_key: string;
    }> = [];
    let hold: {
      id: string;
      status: string;
      client_hold_amount: number;
      ledger_attempt_id: string;
    } | null = null;
    const hasura = {
      getAccount: async () => ({ id: account.id }),
      executeQuery: async (query: string, vars: any) => {
        if (query.includes('GetAccountById')) {
          return { accounts_by_pk: { ...account } };
        }
        if (query.includes('FindTransactionByIdempotencyKey')) {
          return {
            account_transactions: txs.filter((tx) =>
              (vars.keys as string[]).includes(tx.idempotency_key)
            ),
          };
        }
        if (query.includes('HasAccountTransaction')) {
          const found = txs.some(
            (tx) =>
              tx.account_id === vars.accountId &&
              tx.transaction_type === vars.transactionType &&
              tx.reference_id === vars.referenceId
          );
          return { account_transactions: found ? [{ id: 'existing' }] : [] };
        }
        if (query.includes('clients_by_pk')) {
          return { clients_by_pk: { user_id: 'client-user' } };
        }
        if (query.includes('rental_holds')) {
          return { rental_holds: hold ? [{ ...hold }] : [] };
        }
        return {};
      },
      executeMutation: async (mutation: string, vars: any) => {
        if (mutation.includes('ApplyBalanceDelta')) {
          const availableFloor = vars.where?.available_balance?._gte;
          const withheldFloor = vars.where?.withheld_balance?._gte;
          if (
            typeof availableFloor === 'number' &&
            account.available_balance < availableFloor
          ) {
            return { update_accounts: { returning: [] } };
          }
          if (
            typeof withheldFloor === 'number' &&
            account.withheld_balance < withheldFloor
          ) {
            return { update_accounts: { returning: [] } };
          }
          account.available_balance += vars.inc.available_balance;
          account.withheld_balance += vars.inc.withheld_balance;
          account.cash_advance_balance += vars.inc.cash_advance_balance;
          return {
            update_accounts: {
              returning: [
                {
                  available_balance: account.available_balance,
                  withheld_balance: account.withheld_balance,
                  cash_advance_balance: account.cash_advance_balance,
                },
              ],
            },
          };
        }
        if (mutation.includes('idempotency_key')) {
          if (txs.some((tx) => tx.idempotency_key === vars.idempotencyKey)) {
            return { insert_account_transactions_one: null };
          }
          const id = `tx-${txs.length + 1}`;
          txs.push({
            id,
            account_id: vars.accountId,
            amount: vars.amount,
            transaction_type: vars.transactionType,
            reference_id: vars.referenceId,
            idempotency_key: vars.idempotencyKey,
          });
          return { insert_account_transactions_one: { id } };
        }
        if (mutation.includes('insert_rental_holds')) {
          if (hold) {
            throw new Error(
              'Uniqueness violation. duplicate key value violates unique constraint "rental_holds_unique_booking"'
            );
          }
          hold = {
            id: 'h1',
            status: 'active',
            client_hold_amount: vars.object.client_hold_amount,
            ledger_attempt_id: vars.object.ledger_attempt_id,
          };
          return { insert_rental_holds_one: { id: 'h1' } };
        }
        if (vars?.attemptId) {
          if (!hold || hold.status !== 'cancelled') {
            return { update_rental_holds: { affected_rows: 0 } };
          }
          hold = {
            ...hold,
            status: 'active',
            client_hold_amount: vars.amount,
            ledger_attempt_id: vars.attemptId,
          };
          return { update_rental_holds: { affected_rows: 1 } };
        }
        if (vars?.from === 'active' && vars?.status === 'cancelled' && hold?.status === 'active') {
          hold = { ...hold, status: 'cancelled' };
          return { update_rental_holds: { affected_rows: 1 } };
        }
        return { update_rental_holds: { affected_rows: 0 } };
      },
    };
    return {
      account,
      hasura,
      hold: () => hold,
    };
  }

  it('places a new hold after a revert and leaves the winner funded when a duplicate insert loses', async () => {
    const mem = memoryLedger();
    const svc: any = Object.create(RentalsService.prototype);
    svc.logger = { error: jest.fn() };
    svc.hasuraSystemService = mem.hasura;
    svc.accountsService = new AccountsService(mem.hasura as any);

    await svc.placeHoldForBooking('b1', 'c1', 100, 'XAF');
    expect(mem.account.withheld_balance).toBe(100);
    expect(mem.account.available_balance).toBe(400);
    const firstAttempt = mem.hold()?.ledger_attempt_id;

    await svc.releaseHoldIfNeeded('b1', {
      client: { user_id: 'client-user' },
      currency: 'XAF',
    });
    expect(mem.account.withheld_balance).toBe(0);
    expect(mem.account.available_balance).toBe(500);
    expect(mem.hold()?.status).toBe('cancelled');

    await svc.placeHoldForBooking('b1', 'c1', 100, 'XAF');
    expect(mem.account.withheld_balance).toBe(100);
    expect(mem.account.available_balance).toBe(400);
    expect(mem.hold()?.status).toBe('active');
    expect(mem.hold()?.ledger_attempt_id).not.toBe(firstAttempt);
    const winnerAttempt = mem.hold()?.ledger_attempt_id;

    svc.getHold = jest.fn().mockResolvedValue(null);
    await svc.placeHoldForBooking('b1', 'c1', 100, 'XAF');
    expect(mem.account.withheld_balance).toBe(100);
    expect(mem.account.available_balance).toBe(400);
    expect(mem.hold()?.ledger_attempt_id).toBe(winnerAttempt);
    expect(mem.hold()?.status).toBe('active');
  });

  it('releases a hold that lands after cancel already looked, and a second release does not move money', async () => {
    const mem = memoryLedger();
    const svc: any = Object.create(RentalsService.prototype);
    svc.logger = { error: jest.fn() };
    svc.hasuraSystemService = mem.hasura;
    svc.accountsService = new AccountsService(mem.hasura as any);
    const client = { client: { user_id: 'client-user' }, currency: 'XAF' };
    await svc.releaseHoldIfNeeded('b1', client);
    expect(mem.account.withheld_balance).toBe(0);

    svc.casBooking = jest.fn(async () => {
      await svc.releaseHoldIfNeeded('b1', client);
      return false;
    });
    const kept = await svc.finishConfirmedWalletHold(
      {
        id: 'b1',
        client_id: 'c1',
        total_amount: 100,
        currency: 'XAF',
        client: { user_id: 'client-user' },
      },
      'reserved'
    );
    expect(kept).toBe(false);
    expect(mem.hold()?.status).toBe('cancelled');
    expect(mem.account.withheld_balance).toBe(0);
    expect(mem.account.available_balance).toBe(500);

    await svc.releaseHoldIfNeeded('b1', client);
    expect(mem.account.withheld_balance).toBe(0);
    expect(mem.account.available_balance).toBe(500);
  });

  it('keeps the hold and the withheld balance when the paid stamp wins', async () => {
    const mem = memoryLedger();
    const svc: any = Object.create(RentalsService.prototype);
    svc.logger = { error: jest.fn() };
    svc.hasuraSystemService = mem.hasura;
    svc.accountsService = new AccountsService(mem.hasura as any);
    svc.casBooking = jest.fn().mockResolvedValue(true);
    const kept = await svc.finishConfirmedWalletHold(
      {
        id: 'b1',
        client_id: 'c1',
        total_amount: 100,
        currency: 'XAF',
        client: { user_id: 'client-user' },
      },
      'reserved'
    );
    expect(kept).toBe(true);
    expect(mem.hold()?.status).toBe('active');
    expect(mem.account.withheld_balance).toBe(100);
    expect(mem.account.available_balance).toBe(400);
  });
});
