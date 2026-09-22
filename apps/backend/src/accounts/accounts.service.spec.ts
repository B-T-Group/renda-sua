import { AccountsService, cashAdvanceMinBalance } from './accounts.service';

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
      executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-new' } };
        }
        if (mutation.includes('UpdateAccountBalances')) {
          return { update_accounts_by_pk: { id: accountId } };
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
      executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-rest' } };
        }
        return { update_accounts_by_pk: { id: accountId } };
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
  });

  describe('registerTransaction', () => {
    beforeEach(() => {
      mockAccount(activeAccount);
      executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-new' } };
        }
        if (mutation.includes('UpdateAccountBalances')) {
          return { update_accounts_by_pk: { id: accountId } };
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
        String(m).includes('UpdateAccountBalances')
      );
      expect(balanceCall?.[1]).toEqual({
        accountId,
        availableBalance: 1250,
        withheldBalance: 200,
        cashAdvanceBalance: 0,
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

    it('does not re-credit a referenced deposit already applied as repayment', async () => {
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('SumAppliedDeposit')) {
          return { account_transactions: [{ amount: 5000 }] };
        }
        return { accounts_by_pk: activeAccount };
      });

      const result = await service.registerTransaction({
        accountId,
        amount: 5000,
        transactionType: 'deposit',
        memo: 'Mobile payment deposit - retry',
        referenceId,
      });

      expect(result).toEqual({ success: true });
      expect(executeMutation).not.toHaveBeenCalled();
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

    it('sums every deposit and repayment row before crediting a retry leftover', async () => {
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
      executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-sum' } };
        }
        return { update_accounts_by_pk: { id: accountId } };
      });

      const result = await service.registerTransaction({
        accountId,
        amount: 800,
        transactionType: 'deposit',
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

    it('credits only the leftover after a cash-advance repayment for the same reference', async () => {
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('SumAppliedDeposit')) {
          return { account_transactions: [{ amount: 400 }] };
        }
        if (query.includes('GetAccountById')) {
          return {
            accounts_by_pk: { ...activeAccount, cash_advance_balance: 0 },
          };
        }
        return { account_transactions: [] };
      });
      executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('InsertTransaction')) {
          return { insert_account_transactions_one: { id: 'tx-rest' } };
        }
        return { update_accounts_by_pk: { id: accountId } };
      });

      const result = await service.registerTransaction({
        accountId,
        amount: 1000,
        transactionType: 'deposit',
        memo: 'Mobile payment deposit - retry',
        referenceId,
      });

      expect(result.success).toBe(true);
      const insert = executeMutation.mock.calls.find(([mutation]) =>
        String(mutation).includes('InsertTransaction')
      );
      expect(insert?.[1]).toMatchObject({
        amount: 600,
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

    it('claims cash-advance capacity atomically before inserting the ledger row', async () => {
      executeMutation.mockImplementation(async (mutation: string) => {
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
          String(mutation).includes('UpdateAccountBalances')
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
      executeMutation.mockImplementation(async (mutation: string) => {
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
