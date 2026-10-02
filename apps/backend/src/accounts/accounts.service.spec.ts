import { AccountsService, cashAdvanceMinBalance } from './accounts.service';

/** Fake of the atomic ApplyBalanceDelta mutation: base balances + _inc (guard shape asserted separately). */
function fakeApplyDelta(mutation: string, vars?: any, base?: any) {
  if (!String(mutation).includes('ApplyBalanceDelta')) {
    return { update_accounts_by_pk: { id: 'account-1' } };
  }
  const start = base ?? {
    available_balance: 1000,
    withheld_balance: 200,
    cash_advance_balance: 0,
  };
  return {
    update_accounts: {
      returning: [
        {
          available_balance: start.available_balance + vars.inc.available_balance,
          withheld_balance: start.withheld_balance + vars.inc.withheld_balance,
          cash_advance_balance:
            Number(start.cash_advance_balance ?? 0) + vars.inc.cash_advance_balance,
        },
      ],
    },
  };
}

describe('AccountsService', () => {
  const accountId = 'account-1';
  const userId = 'user-1';
  const referenceId = 'ref-1';

  const activeAccount = {
    id: accountId,
    user_id: userId,
    currency: 'XAF',
    available_balance: 1000,
    withheld_balance: 200,
    total_balance: 1200,
    is_active: true,
  };

  let executeQuery: jest.Mock;
  let executeMutation: jest.Mock;
  let service: AccountsService;

  beforeEach(() => {
    executeQuery = jest.fn();
    executeMutation = jest.fn();
    service = new AccountsService({
      executeQuery,
      executeMutation,
    } as never);
  });

  function mockAccount(account: typeof activeAccount | null) {
    executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('GetAccountById')) {
        return { accounts_by_pk: account };
      }
      return {};
    });
  }

  describe('accountBelongsToUser', () => {
    it('returns true only for the active owner', async () => {
      mockAccount(activeAccount);
      await expect(
        service.accountBelongsToUser(accountId, userId)
      ).resolves.toBe(true);
    });

    it('returns false for a different user or inactive account', async () => {
      mockAccount(activeAccount);
      await expect(
        service.accountBelongsToUser(accountId, 'other-user')
      ).resolves.toBe(false);

      mockAccount({ ...activeAccount, is_active: false });
      await expect(
        service.accountBelongsToUser(accountId, userId)
      ).resolves.toBe(false);
    });
  });

  describe('hasTransactionForReference', () => {
    it('returns false when referenceId is missing', async () => {
      await expect(
        service.hasTransactionForReference({
          accountId,
          transactionType: 'deposit',
        })
      ).resolves.toBe(false);
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it('returns true when a matching transaction exists', async () => {
      executeQuery.mockResolvedValue({
        account_transactions: [{ id: 'tx-1' }],
      });

      await expect(
        service.hasTransactionForReference({
          accountId,
          transactionType: 'deposit',
          referenceId,
        })
      ).resolves.toBe(true);

      const [query, variables] = executeQuery.mock.calls[0];
      expect(String(query)).toContain('HasAccountTransaction');
      expect(variables).toEqual({
        accountId,
        transactionType: 'deposit',
        referenceId,
      });
    });
  });

  describe('findDepositByReference', () => {
    it('returns the existing deposit for idempotent payouts', async () => {
      executeQuery.mockResolvedValue({
        account_transactions: [{ id: 'dep-1' }],
      });

      await expect(
        service.findDepositByReference(accountId, referenceId)
      ).resolves.toEqual({ id: 'dep-1' });

      const [query, variables] = executeQuery.mock.calls[0];
      expect(String(query)).toContain('cash_advance_repayment');
      expect(variables).toEqual({ accountId, referenceId });
    });

    it('returns null when no deposit exists', async () => {
      executeQuery.mockResolvedValue({ account_transactions: [] });
      await expect(
        service.findDepositByReference(accountId, referenceId)
      ).resolves.toBeNull();
    });
  });

  describe('registerPaymentIfNotExists', () => {
    it('skips insert when a payment already exists for the reference', async () => {
      executeQuery.mockResolvedValue({
        account_transactions: [{ id: 'pay-1' }],
      });

      await expect(
        service.registerPaymentIfNotExists({
          accountId,
          amount: 150,
          memo: 'Deposit forfeited for order 123',
          referenceId,
        })
      ).resolves.toEqual({ success: true, alreadyExists: true });

      expect(executeMutation).not.toHaveBeenCalled();
    });
  });

  describe('registerDepositIfNotExists', () => {
    it('skips insert when a deposit already exists for the reference', async () => {
      executeQuery.mockResolvedValue({
        account_transactions: [{ id: 'dep-1', amount: 125 }],
      });

      await expect(
        service.registerDepositIfNotExists({
          accountId,
          amount: 125,
          memo: 'Stripe payment deposit - ref',
          referenceId,
        })
      ).resolves.toEqual({ success: true, alreadyExists: true });

      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('inserts a deposit when none exists for the reference', async () => {
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('HasAccountTransaction')) {
          return { account_transactions: [] };
        }
        if (query.includes('GetAccountById')) {
          return { accounts_by_pk: activeAccount };
        }
        return {};
      });
      executeMutation.mockImplementation(async (mutation: string, vars?: any) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-new' } };
        }
        if (mutation.includes('ApplyBalanceDelta')) {
          return fakeApplyDelta(mutation, vars);
        }
        return {};
      });

      await expect(
        service.registerDepositIfNotExists({
          accountId,
          amount: 125,
          memo: 'Stripe payment deposit - ref',
          referenceId,
        })
      ).resolves.toMatchObject({
        success: true,
        alreadyExists: false,
        transactionId: 'tx-new',
      });
    });

    it('credits only the remainder when a repayment leg already exists', async () => {
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('SumAppliedDeposit')) {
          return { account_transactions: [{ amount: 400 }] };
        }
        if (query.includes('GetAccountById')) {
          return { accounts_by_pk: { ...activeAccount, cash_advance_balance: 0 } };
        }
        return { account_transactions: [] };
      });
      executeMutation.mockImplementation(async (mutation: string, vars?: any) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-rest' } };
        }
        return fakeApplyDelta(mutation, vars);
      });

      const result = await service.registerDepositIfNotExists({
        accountId,
        amount: 1000,
        memo: 'top-up',
        referenceId,
      });

      expect(result.success).toBe(true);
      const insert = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('InsertTransaction')
      );
      expect(insert?.[1]).toMatchObject({ amount: 600, transactionType: 'deposit' });
    });

    it('no-ops when repayment plus deposit already cover the reference', async () => {
      executeQuery.mockResolvedValue({
        account_transactions: [{ amount: 400 }, { amount: 600 }],
      });

      await expect(
        service.registerDepositIfNotExists({
          accountId,
          amount: 1000,
          memo: 'Mobile payment deposit - retry',
          referenceId,
        })
      ).resolves.toEqual({ success: true, alreadyExists: true });

      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('credits only the leftover after several applied rows', async () => {
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('SumAppliedDeposit')) {
          return {
            account_transactions: [{ amount: 200 }, { amount: 350 }],
          };
        }
        if (query.includes('GetAccountById')) {
          return {
            accounts_by_pk: { ...activeAccount, cash_advance_balance: 0 },
          };
        }
        return { account_transactions: [] };
      });
      executeMutation.mockImplementation(async (mutation: string, vars?: any) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-sum' } };
        }
        return fakeApplyDelta(mutation, vars);
      });

      const result = await service.registerDepositIfNotExists({
        accountId,
        amount: 800,
        memo: 'Mobile payment deposit - retry',
        referenceId,
      });

      expect(result.success).toBe(true);
      const insert = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('InsertTransaction')
      );
      expect(insert?.[1]).toMatchObject({
        amount: 250,
        transactionType: 'deposit',
      });
    });

    it('skips cash-advance repayment when skipCashAdvanceRepayment is set', async () => {
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('SumAppliedDeposit')) {
          return { account_transactions: [] };
        }
        if (query.includes('GetAccountById')) {
          return {
            accounts_by_pk: {
              ...activeAccount,
              cash_advance_balance: -500,
            },
          };
        }
        return { account_transactions: [] };
      });
      executeMutation.mockImplementation(async (mutation: string, vars?: any) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-dep' } };
        }
        return fakeApplyDelta(mutation, vars);
      });

      const result = await service.registerDepositIfNotExists({
        accountId,
        amount: 300,
        memo: 'order payment',
        referenceId,
        skipCashAdvanceRepayment: true,
      });

      expect(result.success).toBe(true);
      const insert = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('InsertTransaction')
      );
      expect(insert?.[1]).toMatchObject({
        amount: 300,
        transactionType: 'deposit',
      });
      expect(insert?.[1].transactionType).not.toBe('cash_advance_repayment');
    });

    it('credits only the unpaid remainder when skip-repay still counts a prior repayment', async () => {
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('SumAppliedDeposit')) {
          return { account_transactions: [{ amount: 100 }] };
        }
        if (query.includes('GetAccountById')) {
          return {
            accounts_by_pk: { ...activeAccount, cash_advance_balance: -500 },
          };
        }
        return { account_transactions: [] };
      });
      executeMutation.mockImplementation(async (mutation: string, vars?: any) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-gap' } };
        }
        return fakeApplyDelta(mutation, vars);
      });

      const result = await service.registerDepositIfNotExists({
        accountId,
        amount: 300,
        memo: 'order payment retry',
        referenceId,
        skipCashAdvanceRepayment: true,
      });

      expect(result.success).toBe(true);
      const sumCall = executeQuery.mock.calls.find(([query]) =>
        String(query).includes('SumAppliedDeposit')
      );
      expect(String(sumCall?.[0])).toContain('cash_advance_repayment');
      expect(sumCall?.[1]).toEqual({ accountId, referenceId });
      const insert = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('InsertTransaction')
      );
      expect(insert?.[1]).toMatchObject({
        amount: 200,
        transactionType: 'deposit',
      });
    });

    it('does not credit again when a prior repayment already covers the skip-repay deposit', async () => {
      executeQuery.mockResolvedValue({
        account_transactions: [{ amount: 300 }],
      });

      await expect(
        service.registerDepositIfNotExists({
          accountId,
          amount: 300,
          memo: 'order payment retry',
          referenceId,
          skipCashAdvanceRepayment: true,
        })
      ).resolves.toEqual({ success: true, alreadyExists: true });

      expect(executeMutation).not.toHaveBeenCalled();
    });
  });

  describe('registerTransaction idempotencyKey (UAT S-4)', () => {
    const key = 'settle:item:payment:order-1';
    beforeEach(() => {
      mockAccount(activeAccount);
    });

    it('returns alreadyExists without moving any balance when the key is already in the ledger', async () => {
      executeQuery.mockImplementation(async (query: string) =>
        query.includes('FindTransactionByIdempotencyKey')
          ? { account_transactions: [{ id: 'tx-old' }] }
          : { accounts_by_pk: activeAccount }
      );
      const result = await service.registerTransaction({
        accountId,
        amount: 50,
        transactionType: 'payment',
        idempotencyKey: key,
      });
      expect(result).toEqual({
        success: true,
        transactionId: 'tx-old',
        alreadyExists: true,
      });
      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('inserts with ON CONFLICT DO NOTHING on the unique key and stores it', async () => {
      executeMutation.mockImplementation(async (mutation: string, vars?: any) =>
        mutation.includes('InsertTransactionIdempotent')
          ? { insert_account_transactions_one: { id: 'tx-new' } }
          : fakeApplyDelta(mutation, vars)
      );
      executeQuery.mockImplementation(async (query: string) =>
        query.includes('FindTransactionByIdempotencyKey')
          ? { account_transactions: [] }
          : { accounts_by_pk: activeAccount }
      );
      const result = await service.registerTransaction({
        accountId,
        amount: 50,
        transactionType: 'payment',
        idempotencyKey: key,
      });
      expect(result).toMatchObject({ success: true, transactionId: 'tx-new' });
      const insert = executeMutation.mock.calls.find(([m]) =>
        String(m).includes('InsertTransactionIdempotent')
      ) as [string, any];
      expect(insert[0]).toContain('account_transactions_idempotency_key_key');
      expect(insert[1].idempotencyKey).toBe(key);
    });

    it('loses the race (constraint conflict): reverts the balance move and reports alreadyExists', async () => {
      executeMutation.mockImplementation(async (mutation: string, vars?: any) =>
        mutation.includes('InsertTransactionIdempotent')
          ? { insert_account_transactions_one: null }
          : fakeApplyDelta(mutation, vars)
      );
      executeQuery.mockImplementation(async (query: string) =>
        query.includes('FindTransactionByIdempotencyKey')
          ? { account_transactions: [] }
          : { accounts_by_pk: activeAccount }
      );
      const result = await service.registerTransaction({
        accountId,
        amount: 50,
        transactionType: 'payment',
        idempotencyKey: key,
      });
      expect(result).toEqual({ success: true, alreadyExists: true });
      const deltas = executeMutation.mock.calls
        .filter(([m]) => String(m).includes('ApplyBalanceDelta'))
        .map(([, v]) => v.inc.available_balance);
      expect(deltas).toEqual([-50, 50]);
    });

    it('credits the remainder when a retry finds only the cash-advance repayment leg', async () => {
      const key = 'commission:order-1:acct-1:agent:base_delivery_fee';
      executeQuery.mockImplementation(async (query: string, vars?: { key?: string }) => {
        if (String(query).includes('FindTransactionByIdempotencyKey')) {
          if (vars?.key === `${key}:repay`) {
            return { account_transactions: [{ id: 'tx-repay', amount: 400 }] };
          }
          return { account_transactions: [] };
        }
        if (String(query).includes('GetAccountById')) {
          return {
            accounts_by_pk: { ...activeAccount, cash_advance_balance: 0 },
          };
        }
        return {};
      });
      executeMutation.mockImplementation(async (mutation: string, vars?: any) =>
        String(mutation).includes('InsertTransactionIdempotent')
          ? { insert_account_transactions_one: { id: 'tx-remainder' } }
          : fakeApplyDelta(mutation, vars)
      );

      const result = await service.registerTransaction({
        accountId,
        amount: 1000,
        transactionType: 'deposit',
        idempotencyKey: key,
        memo: 'agent commission',
      });

      expect(result).toMatchObject({
        success: true,
        transactionId: 'tx-remainder',
      });
      const insert = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('InsertTransactionIdempotent')
      );
      expect(insert?.[1]).toMatchObject({
        amount: 600,
        transactionType: 'deposit',
        idempotencyKey: key,
      });
    });

    it('treats a keyed deposit fully consumed by cash-advance repayment as done', async () => {
      const key = 'commission:order-1:acct-1:agent:per_km_delivery_fee';
      executeQuery.mockImplementation(async (query: string, vars?: { key?: string }) => {
        if (String(query).includes('FindTransactionByIdempotencyKey')) {
          if (vars?.key === `${key}:repay`) {
            return { account_transactions: [{ id: 'tx-repay', amount: 500 }] };
          }
          return { account_transactions: [] };
        }
        return { accounts_by_pk: { ...activeAccount, cash_advance_balance: 0 } };
      });

      await expect(
        service.registerTransaction({
          accountId,
          amount: 500,
          transactionType: 'deposit',
          idempotencyKey: key,
        })
      ).resolves.toEqual({
        success: true,
        alreadyExists: true,
        transactionId: 'tx-repay',
      });
      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('keyless requests keep the original insert path', async () => {
      executeMutation.mockImplementation(async (mutation: string, vars?: any) =>
        mutation.includes('InsertTransaction')
          ? { insert_account_transactions_one: { id: 'tx-plain' } }
          : fakeApplyDelta(mutation, vars)
      );
      await service.registerTransaction({
        accountId,
        amount: 10,
        transactionType: 'deposit',
      });
      expect(
        executeMutation.mock.calls.some(([m]) =>
          String(m).includes('InsertTransactionIdempotent')
        )
      ).toBe(false);
      expect(executeQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('FindTransactionByIdempotencyKey'),
        expect.anything()
      );
    });
  });

  describe('registerTransaction', () => {
    beforeEach(() => {
      mockAccount(activeAccount);
      executeMutation.mockImplementation(async (mutation: string, vars?: any) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-new' } };
        }
        if (mutation.includes('ApplyBalanceDelta')) {
          return fakeApplyDelta(mutation, vars);
        }
        return {};
      });
    });

    it('rejects missing fields and non-positive amounts', async () => {
      await expect(
        service.registerTransaction({
          accountId: '',
          amount: 10,
          transactionType: 'deposit',
        })
      ).resolves.toMatchObject({
        success: false,
        error: expect.stringContaining('Missing required fields'),
      });

      await expect(
        service.registerTransaction({
          accountId,
          amount: -5,
          transactionType: 'deposit',
        })
      ).resolves.toEqual({
        success: false,
        error: 'Amount must be greater than 0',
      });
    });

    it('treats zero-amount hold and release as successful no-ops', async () => {
      await expect(
        service.registerTransaction({
          accountId,
          amount: 0,
          transactionType: 'hold',
        })
      ).resolves.toEqual({ success: true });
      await expect(
        service.registerTransaction({
          accountId,
          amount: 0,
          transactionType: 'release',
        })
      ).resolves.toEqual({ success: true });
      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('credits available balance on deposit and persists the ledger row', async () => {
      const result = await service.registerTransaction({
        accountId,
        amount: 250,
        transactionType: 'deposit',
        referenceId,
        memo: 'mobile top-up',
      });

      expect(result).toEqual({
        success: true,
        transactionId: 'tx-new',
        newBalance: {
          available: 1250,
          withheld: 200,
          total: 1450,
          cashAdvance: 0,
        },
      });

      const insertCall = executeMutation.mock.calls.find(([m]) =>
        String(m).includes('InsertTransaction')
      );
      expect(insertCall?.[1]).toMatchObject({
        accountId,
        amount: 250,
        transactionType: 'deposit',
        referenceId,
        memo: 'mobile top-up',
      });

      const balanceCall = executeMutation.mock.calls.find(([m]) =>
        String(m).includes('ApplyBalanceDelta')
      );
      // atomic increment, not an absolute overwrite; credits need no funds guard
      expect(balanceCall?.[1]).toEqual({
        where: { id: { _eq: accountId } },
        inc: {
          available_balance: 250,
          withheld_balance: 0,
          cash_advance_balance: 0,
        },
      });
    });

    it('lets a flagged payment drive available balance negative', async () => {
      const result = await service.registerTransaction({
        accountId,
        amount: 1001,
        transactionType: 'payment',
        allowNegative: true,
        memo: 'Scheduled payment source',
      });
      expect(result.success).toBe(true);
      expect(result.newBalance?.available).toBe(-1);
    });

    it('rejects withdrawals that exceed available funds', async () => {
      await expect(
        service.registerTransaction({
          accountId,
          amount: 1001,
          transactionType: 'withdrawal',
        })
      ).resolves.toEqual({
        success: false,
        error: 'Insufficient funds for this transaction',
      });
      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('moves funds from available to withheld on hold', async () => {
      const result = await service.registerTransaction({
        accountId,
        amount: 300,
        transactionType: 'hold',
      });

      expect(result).toMatchObject({
        success: true,
        newBalance: {
          available: 700,
          withheld: 500,
          total: 1200,
        },
      });
    });

    it('repays a negative cash advance before the remainder becomes available', async () => {
      mockAccount({ ...activeAccount, cash_advance_balance: -400 });
      const result = await service.registerTransaction({
        accountId,
        amount: 1000,
        transactionType: 'deposit',
        memo: 'top-up',
      });
      expect(result.success).toBe(true);
      const types = executeMutation.mock.calls
        .filter(([mutation]) => String(mutation).includes('InsertTransaction'))
        .map(([, vars]) => vars.transactionType);
      expect(types).toEqual(['cash_advance_repayment', 'deposit']);
    });

    it('posts a later deposit that shares a reference instead of shrinking it', async () => {
      const result = await service.registerTransaction({
        accountId,
        amount: 300,
        transactionType: 'deposit',
        memo: 'per-km delivery commission',
        referenceId,
      });

      expect(result.success).toBe(true);
      expect(
        executeQuery.mock.calls.some(([query]) =>
          String(query).includes('SumAppliedDeposit')
        )
      ).toBe(false);
      const insert = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('InsertTransaction')
      );
      expect(insert?.[1]).toMatchObject({
        amount: 300,
        transactionType: 'deposit',
        referenceId,
      });
    });

    it('posts the full amount when a deposit has no payment reference', async () => {
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('SumAppliedDeposit')) {
          return { account_transactions: [{ amount: 250 }] };
        }
        if (query.includes('GetAccountById')) {
          return {
            accounts_by_pk: { ...activeAccount, cash_advance_balance: 0 },
          };
        }
        return { account_transactions: [] };
      });

      const result = await service.registerTransaction({
        accountId,
        amount: 250,
        transactionType: 'deposit',
        memo: 'manual adjustment',
      });

      expect(result.success).toBe(true);
      expect(
        executeQuery.mock.calls.some(([query]) =>
          String(query).includes('SumAppliedDeposit')
        )
      ).toBe(false);
      const insert = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('InsertTransaction')
      );
      expect(insert?.[1]).toMatchObject({
        amount: 250,
        transactionType: 'deposit',
      });
    });

    it('posts the full referenced amount even when older rows share that reference', async () => {
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('GetAccountById')) {
          return {
            accounts_by_pk: { ...activeAccount, cash_advance_balance: 0 },
          };
        }
        return { account_transactions: [{ amount: 1000 }] };
      });

      const result = await service.registerTransaction({
        accountId,
        amount: 1600,
        transactionType: 'deposit',
        memo: 'item commission',
        referenceId,
      });

      expect(result.success).toBe(true);
      const insert = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('InsertTransaction')
      );
      expect(insert?.[1]).toMatchObject({
        amount: 1600,
        transactionType: 'deposit',
      });
    });

    it('rejects release when withheld balance is insufficient', async () => {
      await expect(
        service.registerTransaction({
          accountId,
          amount: 201,
          transactionType: 'release',
        })
      ).resolves.toEqual({
        success: false,
        error: 'Insufficient funds for this transaction',
      });
    });

    const lastDelta = () =>
      executeMutation.mock.calls
        .filter(([m]) => String(m).includes('ApplyBalanceDelta'))
        .map(([, v]) => v)
        .at(-1);

    it('guards debits in the same atomic statement as the increment', async () => {
      await service.registerTransaction({
        accountId,
        amount: 300,
        transactionType: 'withdrawal',
      });
      expect(lastDelta()).toEqual({
        where: {
          id: { _eq: accountId },
          available_balance: { _gte: 300 },
        },
        inc: {
          available_balance: -300,
          withheld_balance: 0,
          cash_advance_balance: 0,
        },
      });
    });

    it('guards holds on available and releases on withheld', async () => {
      await service.registerTransaction({
        accountId,
        amount: 50,
        transactionType: 'hold',
      });
      expect(lastDelta()?.where).toEqual({
        id: { _eq: accountId },
        available_balance: { _gte: 50 },
      });
      await service.registerTransaction({
        accountId,
        amount: 50,
        transactionType: 'release',
      });
      expect(lastDelta()?.where).toEqual({
        id: { _eq: accountId },
        withheld_balance: { _gte: 50 },
      });
    });

    it('omits the available guard when allowNegative is set', async () => {
      await service.registerTransaction({
        accountId,
        amount: 5000,
        transactionType: 'payment',
        allowNegative: true,
      });
      expect(lastDelta()?.where).toEqual({ id: { _eq: accountId } });
    });

    it('fails without writing a ledger row when a concurrent debit wins (stale snapshot)', async () => {
      // Snapshot says 1000 available, but the guarded UPDATE matches no row.
      executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('ApplyBalanceDelta')) {
          return { update_accounts: { returning: [] } };
        }
        return {};
      });
      const result = await service.registerTransaction({
        accountId,
        amount: 900,
        transactionType: 'withdrawal',
      });
      expect(result).toEqual({
        success: false,
        error: 'Insufficient funds for this transaction',
      });
      expect(
        executeMutation.mock.calls.some(([m]) =>
          String(m).includes('InsertTransaction')
        )
      ).toBe(false);
    });

    it('reverts the balance delta if the ledger row cannot be inserted', async () => {
      const deltas: any[] = [];
      executeMutation.mockImplementation(async (mutation: string, vars: any) => {
        if (mutation.includes('ApplyBalanceDelta')) {
          deltas.push(vars.inc);
          return fakeApplyDelta(mutation, vars);
        }
        if (mutation.includes('InsertTransaction')) {
          throw new Error('insert failed');
        }
        return {};
      });
      const result = await service.registerTransaction({
        accountId,
        amount: 100,
        transactionType: 'deposit',
      });
      expect(result).toEqual({ success: false, error: 'insert failed' });
      expect(deltas).toEqual([
        { available_balance: 100, withheld_balance: 0, cash_advance_balance: 0 },
        { available_balance: -100, withheld_balance: -0, cash_advance_balance: -0 },
      ]);
    });

    it('applies concurrent increments additively (no lost update)', async () => {
      // Model Postgres: shared row, each statement increments the current value.
      const row = { available_balance: 1000, withheld_balance: 200, cash_advance_balance: 0 };
      executeMutation.mockImplementation(async (mutation: string, vars: any) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx' } };
        }
        if (mutation.includes('ApplyBalanceDelta')) {
          row.available_balance += vars.inc.available_balance;
          row.withheld_balance += vars.inc.withheld_balance;
          row.cash_advance_balance += vars.inc.cash_advance_balance;
          return { update_accounts: { returning: [{ ...row }] } };
        }
        return {};
      });
      // Every caller reads the same stale snapshot (available 1000).
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          service.registerTransaction({
            accountId,
            amount: 10,
            transactionType: 'deposit',
            skipCashAdvanceRepayment: true,
          })
        )
      );
      expect(results.every((r) => r.success)).toBe(true);
      expect(row.available_balance).toBe(1200);
    });

    it('claims cash-advance capacity atomically before inserting the ledger row', async () => {
      executeMutation.mockImplementation(async (mutation: string, vars?: any) => {
        if (mutation.includes('ClaimCashAdvance')) {
          return {
            update_accounts: {
              returning: [
                {
                  available_balance: 1500,
                  withheld_balance: 200,
                  cash_advance_balance: -500,
                },
              ],
            },
          };
        }
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-advance' } };
        }
        return {};
      });

      const result = await service.registerTransaction({
        accountId,
        amount: 500,
        transactionType: 'cash_advance',
        maxCashAdvanceDebt: 1000,
        memo: 'Cash advance draw',
      });

      expect(result).toEqual({
        success: true,
        transactionId: 'tx-advance',
        newBalance: {
          available: 1500,
          withheld: 200,
          total: 1700,
          cashAdvance: -500,
        },
      });
      const claimCall = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('ClaimCashAdvance')
      );
      expect(claimCall?.[1]).toEqual({
        accountId,
        amount: 500,
        negAmount: -500,
        minBalance: -500,
      });
      expect(
        executeMutation.mock.calls.some(([mutation]) =>
          String(mutation).includes('ApplyBalanceDelta')
        )
      ).toBe(false);
    });

    it('rejects a cash-advance draw when the facility limit is missing', async () => {
      await expect(
        service.registerTransaction({
          accountId,
          amount: 500,
          transactionType: 'cash_advance',
        })
      ).resolves.toEqual({
        success: false,
        error: 'Cash-advance limit is required',
      });
      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('rejects a cash-advance draw when the facility limit is zero or NaN', async () => {
      await expect(
        service.registerTransaction({
          accountId,
          amount: 500,
          transactionType: 'cash_advance',
          maxCashAdvanceDebt: 0,
        })
      ).resolves.toEqual({
        success: false,
        error: 'Cash-advance limit is required',
      });
      await expect(
        service.registerTransaction({
          accountId,
          amount: 500,
          transactionType: 'cash_advance',
          maxCashAdvanceDebt: Number.NaN,
        })
      ).resolves.toEqual({
        success: false,
        error: 'Cash-advance limit is required',
      });
      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('rejects a cash-advance draw when the atomic claim finds no remaining room', async () => {
      executeMutation.mockResolvedValue({ update_accounts: { returning: [] } });
      await expect(
        service.registerTransaction({
          accountId,
          amount: 500,
          transactionType: 'cash_advance',
          maxCashAdvanceDebt: 400,
        })
      ).resolves.toEqual({
        success: false,
        error: 'Draw exceeds the remaining cash-advance limit',
      });
      expect(
        executeMutation.mock.calls.some(([mutation]) =>
          String(mutation).includes('InsertTransaction')
        )
      ).toBe(false);
    });

    it('releases the cash-advance claim if the ledger insert fails', async () => {
      executeMutation.mockImplementation(async (mutation: string, vars?: any) => {
        if (mutation.includes('ClaimCashAdvance')) {
          return {
            update_accounts: {
              returning: [
                {
                  available_balance: 1500,
                  withheld_balance: 200,
                  cash_advance_balance: -500,
                },
              ],
            },
          };
        }
        if (mutation.includes('InsertTransaction')) {
          throw new Error('insert failed');
        }
        return { update_accounts: { affected_rows: 1 } };
      });

      await expect(
        service.registerTransaction({
          accountId,
          amount: 500,
          transactionType: 'cash_advance',
          maxCashAdvanceDebt: 1000,
        })
      ).resolves.toEqual({
        success: false,
        error: 'insert failed',
      });
      const releaseCall = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('ReleaseCashAdvanceClaim')
      );
      expect(releaseCall?.[1]).toEqual({
        accountId,
        amount: -500,
        posAmount: 500,
      });
    });
  });

  describe('cashAdvanceMinBalance', () => {
    it('requires current debt plus the draw to stay within the facility limit', () => {
      expect(cashAdvanceMinBalance(1000, 500)).toBe(-500);
      expect(cashAdvanceMinBalance(1000, 1000)).toBe(0);
      expect(cashAdvanceMinBalance(100, 150)).toBe(50);
    });
  });
});
