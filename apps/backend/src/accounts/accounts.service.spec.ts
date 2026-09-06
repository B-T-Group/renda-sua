import { AccountsService } from './accounts.service';

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
      expect(String(query)).toContain('transaction_type: { _eq: "deposit" }');
      expect(variables).toEqual({ accountId, referenceId });
    });

    it('returns null when no deposit exists', async () => {
      executeQuery.mockResolvedValue({ account_transactions: [] });
      await expect(
        service.findDepositByReference(accountId, referenceId)
      ).resolves.toBeNull();
    });
  });

  describe('registerDepositIfNotExists', () => {
    it('skips insert when a deposit already exists for the reference', async () => {
      executeQuery.mockResolvedValue({
        account_transactions: [{ id: 'dep-1' }],
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
      });
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
  });
});
