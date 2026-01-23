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
    | 'exchange';
  memo?: string;
  referenceId?: string;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  newBalance?: {
    available: number;
    withheld: number;
    total: number;
  };
  error?: string;
}

@Injectable()
export class AccountsService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Register a transaction and update account balances based on transaction type
   */
  async registerTransaction(
    request: TransactionRequest
  ): Promise<TransactionResult> {
    try {
      // Validate input
      if (!request.accountId || !request.amount || !request.transactionType) {
        return {
          success: false,
          error:
            'Missing required fields: accountId, amount, or transactionType',
        };
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

      // Determine if this is a credit or debit transaction
      const { isCredit, balanceUpdate } = this.determineTransactionType(
        request.transactionType,
        request.amount
      );

      // Calculate new balances
      const newBalances = this.calculateNewBalances(account, balanceUpdate);

      // Validate sufficient funds for debit transactions
      if (
        !isCredit &&
        !this.hasSufficientFunds(
          account,
          balanceUpdate,
          request.transactionType
        )
      ) {
        return {
          success: false,
          error: 'Insufficient funds for this transaction',
        };
      }

      // Insert transaction record
      const transactionId = await this.insertTransaction(request);

      // Update account balances
      await this.updateAccountBalances(request.accountId, newBalances);

      return {
        success: true,
        transactionId,
        newBalance: newBalances,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to register transaction',
      };
    }
  }

  /**
   * Determine if transaction is credit/debit and calculate balance updates
   */
  private determineTransactionType(
    transactionType: string,
    amount: number
  ): {
    isCredit: boolean;
    balanceUpdate: { available: number; withheld: number };
  } {
    const balanceUpdate = { available: 0, withheld: 0 };

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
          balanceUpdate: { available: -amount, withheld: amount },
        };

      case 'release':
        return {
          isCredit: true,
          balanceUpdate: { available: amount, withheld: -amount },
        };

      case 'transfer':
        // Transfer affects available balance (debit from source, credit to destination)
        return {
          isCredit: false,
          balanceUpdate: { ...balanceUpdate, available: -amount },
        };

      case 'adjustment':
        // Manual adjustments can be positive or negative
        return {
          isCredit: amount > 0,
          balanceUpdate: { ...balanceUpdate, available: amount },
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
    balanceUpdate: { available: number; withheld: number }
  ): { available: number; withheld: number; total: number } {
    const newAvailable =
      currentAccount.available_balance + balanceUpdate.available;
    const newWithheld =
      currentAccount.withheld_balance + balanceUpdate.withheld;
    const newTotal = newAvailable + newWithheld;

    return {
      available: newAvailable,
      withheld: newWithheld,
      total: newTotal,
    };
  }

  /**
   * Check if account has sufficient funds for debit transaction
   */
  private hasSufficientFunds(
    account: any,
    balanceUpdate: { available: number; withheld: number },
    transactionType: string
  ): boolean {
    // For hold transactions, check available balance
    if (transactionType === 'hold') {
      return account.available_balance >= amount;
    }

    // For other debit transactions, check available balance
    if (balanceUpdate.available < 0) {
      return account.available_balance >= balanceUpdate.available * -1;
    }

    // For withheld balance decreases, check withheld balance
    if (balanceUpdate.withheld < 0) {
      return account.withheld_balance >= balanceUpdate.withheld * -1;
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
    balances: { available: number; withheld: number }
  ): Promise<void> {
    const mutation = `
      mutation UpdateAccountBalances(
        $accountId: uuid!, 
        $availableBalance: numeric!, 
        $withheldBalance: numeric!
      ) {
        update_accounts_by_pk(
          pk_columns: { id: $accountId },
          _set: {
            available_balance: $availableBalance,
            withheld_balance: $withheldBalance,
            updated_at: "now()"
          }
        ) {
          id
          available_balance
          withheld_balance
          total_balance
          updated_at
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      accountId,
      availableBalance: balances.available,
      withheldBalance: balances.withheld,
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

  /**
   * Get account balance summary
   */
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
      totalBalance: account.total_balance,
      isActive: account.is_active,
    };
  }
}
