import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface TransactionRequest {
  accountId: string;
  amount: number;
  transactionType:
    | 'deposit'
    | 'withdrawal'
    | 'hold'
    | 'release'
    | 'transfer'
    | 'payment'
    | 'refund'
    | 'fee'
    | 'adjustment'
    | 'exchange'
    | 'cash_advance'
    | 'cash_advance_repayment';
  memo?: string;
  referenceId?: string;
  /** Skip the available-balance floor. Used when HQ funds a scheduled stipend. */
  allowNegative?: boolean;
  /** Facility cap. Required for cash_advance so concurrent draws cannot exceed it. */
  maxCashAdvanceDebt?: number;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  newBalance?: {
    available: number;
    withheld: number;
    total: number;
    cashAdvance: number;
  };
  error?: string;
}

export interface WithdrawalRegistrationResult extends TransactionResult {
  alreadyExists?: boolean;
}

export type IdempotentTransactionResult = WithdrawalRegistrationResult;

@Injectable()
export class AccountsService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getBusinessWithdrawalPinStateByAccountId(accountId: string): Promise<{
    businessId: string;
    enabled: boolean;
    hash: string | null;
  } | null> {
    const account = await this.getAccountById(accountId);
    if (!account?.user_id) return null;

    const query = `
      query GetBusinessWithdrawalPinState($userId: uuid!) {
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
          id
          withdrawal_pin_enabled
          withdrawal_pin_hashed
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId: account.user_id,
    });
    const business = (result.businesses || [])[0];
    if (!business?.id) return null;
    return {
      businessId: business.id,
      enabled: business.withdrawal_pin_enabled === true,
      hash: typeof business.withdrawal_pin_hashed === 'string' ? business.withdrawal_pin_hashed : null,
    };
  }

  async getWithdrawalConfig(accountId: string): Promise<{ requirePin: boolean }> {
    const account = await this.getAccountById(accountId);
    if (!account?.user_id) return { requirePin: false };

    const businessQuery = `
      query GetBusinessWithdrawalPinEnabled($userId: uuid!) {
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
          id
          withdrawal_pin_enabled
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(businessQuery, {
      userId: account.user_id,
    });
    const business = (result.businesses || [])[0];
    return { requirePin: business?.withdrawal_pin_enabled === true };
  }

  /**
   * Register a transaction and update account balances based on transaction type
   */
  async registerTransaction(
    request: TransactionRequest
  ): Promise<TransactionResult> {
    try {
      // Validate input
      if (!request.accountId || request.amount == null || !request.transactionType) {
        return {
          success: false,
          error:
            'Missing required fields: accountId, amount, or transactionType',
        };
      }

      // Do not register hold or release when amount is 0 (no-op, success)
      if (
        (request.transactionType === 'hold' || request.transactionType === 'release') &&
        request.amount === 0
      ) {
        return { success: true };
      }

      if (request.amount <= 0) {
        return {
          success: false,
          error: 'Amount must be greater than 0',
        };
      }

      // Get current account details
      const account = await this.getAccountById(request.accountId);
      if (!account) {
        return {
          success: false,
          error: 'Account not found',
        };
      }

      if (request.transactionType === 'deposit') {
        const repaid = await this.repayAdvanceOnDeposit(request, account);
        if (repaid) return repaid;
      }

      if (request.transactionType === 'cash_advance') {
        return this.applyCashAdvanceDraw(request);
      }

      return this.applyLedgerEntry(request, account);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to register transaction',
      };
    }
  }

  private async applyLedgerEntry(
    request: TransactionRequest,
    account: any
  ): Promise<TransactionResult> {
    const { balanceUpdate } = this.determineTransactionType(
      request.transactionType,
      request.amount
    );
    const newBalances = this.calculateNewBalances(account, balanceUpdate);
    if (!this.hasSufficientFunds(account, balanceUpdate, request)) {
      return { success: false, error: 'Insufficient funds for this transaction' };
    }
    const transactionId = await this.insertTransaction(request);
    await this.updateAccountBalances(request.accountId, newBalances);
    return { success: true, transactionId, newBalance: newBalances };
  }

  async hasTransactionForReference(
    request: Pick<
      TransactionRequest,
      'accountId' | 'transactionType' | 'referenceId'
    >
  ): Promise<boolean> {
    if (!request.referenceId) return false;
    const query = `
      query HasAccountTransaction(
        $accountId: uuid!
        $transactionType: transaction_type_enum!
        $referenceId: uuid!
      ) {
        account_transactions(
          where: {
            account_id: { _eq: $accountId }
            transaction_type: { _eq: $transactionType }
            reference_id: { _eq: $referenceId }
          }
          limit: 1
        ) { id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      accountId: request.accountId,
      transactionType: request.transactionType,
      referenceId: request.referenceId,
    });
    return (result.account_transactions?.length ?? 0) > 0;
  }

  /**
   * Idempotent withdrawal: skips registerTransaction when a withdrawal already
   * exists for the same account + referenceId.
   */
  async registerWithdrawalIfNotExists(
    request: Pick<
      TransactionRequest,
      'accountId' | 'amount' | 'memo' | 'referenceId'
    >
  ): Promise<WithdrawalRegistrationResult> {
    return this.registerLedgerEntryIfNotExists(request, 'withdrawal');
  }

  async registerDepositIfNotExists(
    request: Pick<
      TransactionRequest,
      'accountId' | 'amount' | 'memo' | 'referenceId'
    >
  ): Promise<IdempotentTransactionResult> {
    if (!request.referenceId) {
      return { success: false, error: 'referenceId is required' };
    }
    const remaining = await this.unappliedDepositAmount(
      request.accountId,
      request.referenceId,
      request.amount
    );
    if (remaining <= 0) return { success: true, alreadyExists: true };
    const result = await this.registerTransaction({
      ...request,
      amount: remaining,
      transactionType: 'deposit',
    });
    if (!result.success) {
      const stillOpen = await this.unappliedDepositAmount(
        request.accountId,
        request.referenceId,
        request.amount
      );
      if (stillOpen <= 0) return { success: true, alreadyExists: true };
    }
    return { ...result, alreadyExists: false };
  }

  private async unappliedDepositAmount(
    accountId: string,
    referenceId: string,
    amount: number
  ): Promise<number> {
    const applied = await this.sumAppliedDeposit(accountId, referenceId);
    return Number((amount - applied).toFixed(2));
  }

  private async sumAppliedDeposit(
    accountId: string,
    referenceId: string
  ): Promise<number> {
    const query = `
      query SumAppliedDeposit($accountId: uuid!, $referenceId: uuid!) {
        account_transactions(
          where: {
            account_id: { _eq: $accountId }
            reference_id: { _eq: $referenceId }
            transaction_type: { _in: ["deposit", "cash_advance_repayment"] }
          }
        ) { amount }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      accountId,
      referenceId,
    });
    const rows = result.account_transactions ?? [];
    return rows.reduce(
      (sum: number, row: { amount?: number }) => sum + Number(row.amount || 0),
      0
    );
  }

  private async repayAdvanceOnDeposit(
    request: TransactionRequest,
    account: {
      cash_advance_balance?: number;
      available_balance?: number;
      withheld_balance?: number;
    }
  ): Promise<TransactionResult | null> {
    const debt = Number(account.cash_advance_balance ?? 0);
    if (debt >= 0) return null;
    const repay = Math.min(request.amount, Math.abs(debt));
    const remainder = Number((request.amount - repay).toFixed(2));
    const repayment = await this.applyLedgerEntry(
      {
        ...request,
        amount: repay,
        transactionType: 'cash_advance_repayment',
        memo: `Cash advance repayment${request.memo ? ` - ${request.memo}` : ''}`,
      },
      account
    );
    if (!repayment.success || remainder <= 0) return repayment;
    const refreshed = {
      ...account,
      cash_advance_balance: repayment.newBalance?.cashAdvance ?? 0,
      available_balance: repayment.newBalance?.available ?? account.available_balance,
      withheld_balance: repayment.newBalance?.withheld ?? account.withheld_balance,
    };
    return this.applyLedgerEntry(
      { ...request, amount: remainder, transactionType: 'deposit' },
      refreshed
    );
  }

  async registerHoldIfNotExists(
    request: Pick<
      TransactionRequest,
      'accountId' | 'amount' | 'memo' | 'referenceId'
    >
  ): Promise<IdempotentTransactionResult> {
    return this.registerLedgerEntryIfNotExists(request, 'hold');
  }

  async registerReleaseIfNotExists(
    request: Pick<
      TransactionRequest,
      'accountId' | 'amount' | 'memo' | 'referenceId'
    >
  ): Promise<IdempotentTransactionResult> {
    return this.registerLedgerEntryIfNotExists(request, 'release');
  }

  async registerPaymentIfNotExists(
    request: Pick<
      TransactionRequest,
      'accountId' | 'amount' | 'memo' | 'referenceId'
    >
  ): Promise<IdempotentTransactionResult> {
    return this.registerLedgerEntryIfNotExists(request, 'payment');
  }

  private async registerLedgerEntryIfNotExists(
    request: Pick<
      TransactionRequest,
      'accountId' | 'amount' | 'memo' | 'referenceId'
    >,
    transactionType: 'deposit' | 'withdrawal' | 'hold' | 'release' | 'payment'
  ): Promise<IdempotentTransactionResult> {
    if (!request.referenceId) {
      return { success: false, error: 'referenceId is required' };
    }
    const alreadyExists = await this.hasTransactionForReference({
      accountId: request.accountId,
      transactionType,
      referenceId: request.referenceId,
    });
    if (alreadyExists) {
      return { success: true, alreadyExists: true };
    }
    const result = await this.registerTransaction({
      accountId: request.accountId,
      amount: request.amount,
      transactionType,
      memo: request.memo,
      referenceId: request.referenceId,
    });
    if (!result.success) {
      const raced = await this.hasTransactionForReference({
        accountId: request.accountId,
        transactionType,
        referenceId: request.referenceId,
      });
      if (raced) {
        return { success: true, alreadyExists: true };
      }
    }
    return { ...result, alreadyExists: false };
  }

  /**
   * Determine if transaction is credit/debit and calculate balance updates
   */
  private determineTransactionType(
    transactionType: string,
    amount: number
  ): {
    isCredit: boolean;
    balanceUpdate: { available: number; withheld: number; cashAdvance: number };
  } {
    const balanceUpdate = { available: 0, withheld: 0, cashAdvance: 0 };

    switch (transactionType) {
      case 'deposit':
      case 'refund':
      case 'exchange':
        return {
          isCredit: true,
          balanceUpdate: { ...balanceUpdate, available: amount },
        };

      case 'withdrawal':
      case 'payment':
      case 'fee':
        return {
          isCredit: false,
          balanceUpdate: { ...balanceUpdate, available: -amount },
        };

      case 'hold':
        return {
          isCredit: false,
          balanceUpdate: { available: -amount, withheld: amount, cashAdvance: 0 },
        };

      case 'release':
        return {
          isCredit: true,
          balanceUpdate: { available: amount, withheld: -amount, cashAdvance: 0 },
        };

      case 'transfer':
        // Transfer affects available balance (debit from source, credit to destination)
        return {
          isCredit: false,
          balanceUpdate: { ...balanceUpdate, available: -amount },
        };

      case 'adjustment':
        return {
          isCredit: amount > 0,
          balanceUpdate: { ...balanceUpdate, available: amount },
        };

      case 'cash_advance':
        return {
          isCredit: true,
          balanceUpdate: { available: amount, withheld: 0, cashAdvance: -amount },
        };

      case 'cash_advance_repayment':
        return {
          isCredit: false,
          balanceUpdate: { available: 0, withheld: 0, cashAdvance: amount },
        };

      default:
        throw new Error(`Unsupported transaction type: ${transactionType}`);
    }
  }

  /**
   * Calculate new account balances after transaction
   */
  private calculateNewBalances(
    currentAccount: any,
    balanceUpdate: { available: number; withheld: number; cashAdvance: number }
  ): { available: number; withheld: number; total: number; cashAdvance: number } {
    const newAvailable =
      currentAccount.available_balance + balanceUpdate.available;
    const newWithheld =
      currentAccount.withheld_balance + balanceUpdate.withheld;
    const newCashAdvance =
      Number(currentAccount.cash_advance_balance ?? 0) + balanceUpdate.cashAdvance;
    const newTotal = newAvailable + newWithheld;

    return {
      available: newAvailable,
      withheld: newWithheld,
      total: newTotal,
      cashAdvance: newCashAdvance,
    };
  }

  /**
   * Check if account has sufficient funds for debit transaction
   */
  private hasSufficientFunds(
    account: any,
    balanceUpdate: { available: number; withheld: number; cashAdvance: number },
    request: TransactionRequest
  ): boolean {
    const transactionType = request.transactionType;
    if (transactionType === 'cash_advance_repayment') {
      return Math.abs(Number(account.cash_advance_balance ?? 0)) >= balanceUpdate.cashAdvance;
    }
    if (transactionType === 'hold') {
      return account.available_balance >= Math.abs(balanceUpdate.available);
    }
    if (transactionType === 'release') {
      return account.withheld_balance >= Math.abs(balanceUpdate.withheld);
    }
    if (balanceUpdate.available < 0) {
      if (request.allowNegative) return true;
      return account.available_balance >= Math.abs(balanceUpdate.available);
    }

    // For other transactions that decrease withheld balance, check withheld balance
    if (balanceUpdate.withheld < 0) {
      return account.withheld_balance >= Math.abs(balanceUpdate.withheld);
    }

    return true;
  }

  /**
   * Insert transaction record into database
   */
  private async insertTransaction(
    request: TransactionRequest
  ): Promise<string> {
    const mutation = `
      mutation InsertTransaction(
        $accountId: uuid!, 
        $amount: numeric!, 
        $transactionType: transaction_type_enum!, 
        $memo: String, 
        $referenceId: uuid
      ) {
        insert_account_transactions_one(object: {
          account_id: $accountId,
          amount: $amount,
          transaction_type: $transactionType,
          memo: $memo,
          reference_id: $referenceId
        }) {
          id
          account_id
          amount
          transaction_type
          memo
          reference_id
          created_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(mutation, {
      accountId: request.accountId,
      amount: request.amount,
      transactionType: request.transactionType,
      memo: request.memo || null,
      referenceId: request.referenceId || null,
    });

    return result.insert_account_transactions_one.id;
  }

  /**
   * Update account balances
   */
  private async updateAccountBalances(
    accountId: string,
    balances: { available: number; withheld: number; cashAdvance: number }
  ): Promise<void> {
    const mutation = `
      mutation UpdateAccountBalances(
        $accountId: uuid!, 
        $availableBalance: numeric!, 
        $withheldBalance: numeric!,
        $cashAdvanceBalance: numeric!
      ) {
        update_accounts_by_pk(
          pk_columns: { id: $accountId },
          _set: {
            available_balance: $availableBalance,
            withheld_balance: $withheldBalance,
            cash_advance_balance: $cashAdvanceBalance,
            updated_at: "now()"
          }
        ) {
          id
          available_balance
          withheld_balance
          cash_advance_balance
          total_balance
          updated_at
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      accountId,
      availableBalance: balances.available,
      withheldBalance: balances.withheld,
      cashAdvanceBalance: balances.cashAdvance,
    });
  }

  /**
   * Get account by ID
   */
  private async getAccountById(accountId: string): Promise<any> {
    const query = `
      query GetAccountById($accountId: uuid!) {
        accounts_by_pk(id: $accountId) {
          id
          user_id
          currency
          available_balance
          withheld_balance
          cash_advance_balance
          total_balance
          is_active
          created_at
          updated_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      accountId,
    });

    return result.accounts_by_pk;
  }

  /**
   * Get account transactions for an account
   */
  async getAccountTransactions(
    accountId: string,
    limit = 50,
    offset = 0
  ): Promise<any[]> {
    const query = `
      query GetAccountTransactions($accountId: uuid!, $limit: Int!, $offset: Int!) {
        account_transactions(
          where: { account_id: { _eq: $accountId } },
          order_by: { created_at: desc },
          limit: $limit,
          offset: $offset
        ) {
          id
          account_id
          amount
          transaction_type
          memo
          reference_id
          created_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      accountId,
      limit,
      offset,
    });

    return result.account_transactions || [];
  }

  async getDepositsByMemoPrefix(
    accountId: string,
    memoPrefix: string,
    limit = 20,
    offset = 0
  ): Promise<Array<{
    id: string;
    amount: number;
    memo: string;
    transaction_type: string;
    reference_id: string | null;
    created_at: string;
  }>> {
    const query = `
      query GetDepositsByMemo($accountId: uuid!, $memoPrefix: String!, $limit: Int!, $offset: Int!) {
        account_transactions(
          where: {
            account_id: { _eq: $accountId }
            memo: { _ilike: $memoPrefix }
            transaction_type: { _in: ["deposit", "cash_advance_repayment"] }
          }
          order_by: { created_at: desc }
          limit: $limit
          offset: $offset
        ) {
          id
          amount
          memo
          transaction_type
          reference_id
          created_at
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      account_transactions: Array<{
        id: string;
        amount: number;
        memo: string;
        transaction_type: string;
        reference_id: string | null;
        created_at: string;
      }>;
    }>(query, { accountId, memoPrefix: `${memoPrefix}%`, limit, offset });
    return result.account_transactions ?? [];
  }
  async getAccountBalance(accountId: string): Promise<any> {
    const account = await this.getAccountById(accountId);
    if (!account) {
      return null;
    }

    return {
      accountId: account.id,
      currency: account.currency,
      availableBalance: account.available_balance,
      withheldBalance: account.withheld_balance,
      cashAdvanceBalance: account.cash_advance_balance ?? 0,
      totalBalance: account.total_balance,
      isActive: account.is_active,
    };
  }

  async accountBelongsToUser(
    accountId: string,
    userId: string
  ): Promise<boolean> {
    const account = await this.getAccountById(accountId);
    return account?.user_id === userId && account.is_active === true;
  }

  /**
   * Find an existing deposit by account + reference (idempotency helper).
   */
  async findDepositByReference(
    accountId: string,
    referenceId: string
  ): Promise<{ id: string } | null> {
    const query = `
      query FindDepositByReference($accountId: uuid!, $referenceId: uuid!) {
        account_transactions(
          where: {
            account_id: { _eq: $accountId }
            reference_id: { _eq: $referenceId }
            transaction_type: { _in: ["deposit", "cash_advance_repayment"] }
          }
          limit: 1
        ) { id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      accountId,
      referenceId,
    });
    return result.account_transactions?.[0] ?? null;
  }

  /** Find any deposit with this reference (account-agnostic idempotency). */
  async findDepositByReferenceId(
    referenceId: string
  ): Promise<{ id: string; account_id: string } | null> {
    const query = `
      query FindDepositByReferenceId($referenceId: uuid!) {
        account_transactions(
          where: {
            reference_id: { _eq: $referenceId }
            transaction_type: { _in: ["deposit", "cash_advance_repayment"] }
          }
          limit: 1
        ) { id account_id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      referenceId,
    });
    return result.account_transactions?.[0] ?? null;
  }

  private async applyCashAdvanceDraw(
    request: TransactionRequest
  ): Promise<TransactionResult> {
    const limit = Number(request.maxCashAdvanceDebt);
    if (!Number.isFinite(limit) || limit <= 0) {
      return { success: false, error: 'Cash-advance limit is required' };
    }
    const claimed = await this.claimCashAdvanceCapacity(
      request.accountId,
      request.amount,
      limit
    );
    if (!claimed) {
      return { success: false, error: 'Draw exceeds the remaining cash-advance limit' };
    }
    return this.persistClaimedCashAdvance(request, claimed);
  }

  private async persistClaimedCashAdvance(
    request: TransactionRequest,
    claimed: NonNullable<TransactionResult['newBalance']>
  ): Promise<TransactionResult> {
    try {
      const transactionId = await this.insertTransaction(request);
      return { success: true, transactionId, newBalance: claimed };
    } catch (error: any) {
      await this.releaseCashAdvanceClaim(request.accountId, request.amount);
      return {
        success: false,
        error: error.message || 'Failed to register transaction',
      };
    }
  }

  private async claimCashAdvanceCapacity(
    accountId: string,
    amount: number,
    limit: number
  ): Promise<NonNullable<TransactionResult['newBalance']> | null> {
    const result = await this.hasuraSystemService.executeMutation(
      CLAIM_CASH_ADVANCE,
      {
        accountId,
        amount,
        negAmount: -amount,
        minBalance: cashAdvanceMinBalance(limit, amount),
      }
    );
    const row = result.update_accounts?.returning?.[0];
    return row ? balancesFromAccount(row) : null;
  }

  private async releaseCashAdvanceClaim(
    accountId: string,
    amount: number
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(RELEASE_CASH_ADVANCE, {
      accountId,
      amount: -amount,
      posAmount: amount,
    });
  }
}

export function cashAdvanceMinBalance(limit: number, amount: number): number {
  return Number((-(limit - amount)).toFixed(2));
}

function balancesFromAccount(row: {
  available_balance: number;
  withheld_balance: number;
  cash_advance_balance: number;
}): NonNullable<TransactionResult['newBalance']> {
  const available = Number(row.available_balance);
  const withheld = Number(row.withheld_balance);
  return {
    available,
    withheld,
    total: available + withheld,
    cashAdvance: Number(row.cash_advance_balance),
  };
}

const CLAIM_CASH_ADVANCE = `
  mutation ClaimCashAdvance(
    $accountId: uuid!
    $amount: numeric!
    $negAmount: numeric!
    $minBalance: numeric!
  ) {
    update_accounts(
      where: {
        id: { _eq: $accountId }
        cash_advance_balance: { _gte: $minBalance }
      }
      _inc: {
        available_balance: $amount
        cash_advance_balance: $negAmount
      }
    ) {
      returning {
        available_balance
        withheld_balance
        cash_advance_balance
      }
    }
  }
`;

const RELEASE_CASH_ADVANCE = `
  mutation ReleaseCashAdvanceClaim(
    $accountId: uuid!
    $amount: numeric!
    $posAmount: numeric!
  ) {
    update_accounts(
      where: { id: { _eq: $accountId } }
      _inc: {
        available_balance: $amount
        cash_advance_balance: $posAmount
      }
    ) { affected_rows }
  }
`;
