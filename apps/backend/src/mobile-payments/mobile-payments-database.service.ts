import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface MobilePaymentTransaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
  provider: string;
  payment_method: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  transaction_id?: string;
  customer_phone?: string;
  customer_email?: string;
  error_message?: string;
  error_code?: string;
  account_id?: string;
  transaction_type: 'PAYMENT' | 'GIVE_CHANGE';
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionData {
  reference: string;
  amount: number;
  currency: string;
  description: string;
  provider: string;
  payment_method: string;
  customer_phone?: string;
  customer_email?: string;
  account_id?: string;
  transaction_type?: 'PAYMENT' | 'GIVE_CHANGE';
}

export interface UpdateTransactionData {
  status?: 'pending' | 'success' | 'failed' | 'cancelled';
  transaction_id?: string;
  error_message?: string;
  error_code?: string;
}

@Injectable()
export class MobilePaymentsDatabaseService {
  private readonly logger = new Logger(MobilePaymentsDatabaseService.name);

  constructor(private readonly hasuraService: HasuraSystemService) {}

  /**
   * Create a new mobile payment transaction
   */
  async createTransaction(
    data: CreateTransactionData
  ): Promise<MobilePaymentTransaction> {
    try {
      const mutation = `
        mutation CreateMobilePaymentTransaction($data: mobile_payment_transactions_insert_input!) {
          insert_mobile_payment_transactions_one(object: $data) {
            id
            reference
            amount
            currency
            description
            provider
            payment_method
            status
            transaction_id
            customer_phone
            customer_email
            error_message
            error_code
            account_id
            transaction_type
            created_at
            updated_at
          }
        }
      `;

      const variables = {
        data: {
          ...data,
          status: 'pending',
        },
      };

      const response = await this.hasuraService.executeMutation(
        mutation,
        variables
      );
      return response.insert_mobile_payment_transactions_one;
    } catch (error) {
      this.logger.error('Failed to create mobile payment transaction:', error);
      throw error;
    }
  }

  /**
   * Update a mobile payment transaction
   */
  async updateTransaction(
    id: string,
    data: UpdateTransactionData
  ): Promise<MobilePaymentTransaction> {
    try {
      const mutation = `
        mutation UpdateMobilePaymentTransaction($id: uuid!, $data: mobile_payment_transactions_set_input!) {
          update_mobile_payment_transactions_by_pk(
            pk_columns: { id: $id }
            _set: $data
          ) {
            id
            reference
            amount
            currency
            description
            provider
            payment_method
            status
            transaction_id
            customer_phone
            customer_email
            error_message
            error_code
            created_at
            updated_at
          }
        }
      `;

      const variables = {
        id,
        data: {
          ...data,
          updated_at: new Date().toISOString(),
        },
      };

      const response = await this.hasuraService.executeMutation(
        mutation,
        variables
      );
      return response.update_mobile_payment_transactions_by_pk;
    } catch (error) {
      this.logger.error('Failed to update mobile payment transaction:', error);
      throw error;
    }
  }

  /**
   * Get a mobile payment transaction by ID
   */
  async getTransactionById(
    id: string
  ): Promise<MobilePaymentTransaction | null> {
    try {
      const query = `
        query GetMobilePaymentTransaction($id: uuid!) {
          mobile_payment_transactions_by_pk(id: $id) {
            id
            reference
            amount
            currency
            description
            provider
            payment_method
            status
            transaction_id
            account_id
            transaction_type
            customer_phone
            customer_email
            error_message
            error_code
            created_at
            updated_at
          }
        }
      `;

      const variables = { id };
      const response = await this.hasuraService.executeQuery(query, variables);
      return response.mobile_payment_transactions_by_pk;
    } catch (error) {
      this.logger.error('Failed to get mobile payment transaction:', error);
      throw error;
    }
  }

  /**
   * Get a mobile payment transaction by reference
   */
  async getTransactionByReference(
    reference: string
  ): Promise<MobilePaymentTransaction | null> {
    try {
      const query = `
        query GetMobilePaymentTransactionByReference($reference: String!) {
          mobile_payment_transactions(where: { reference: { _eq: $reference } }, limit: 1) {
            id
            reference
            amount
            currency
            description
            provider
            payment_method
            status
            transaction_id
            account_id
            transaction_type
            customer_phone
            customer_email
            error_message
            error_code
            created_at
            updated_at
          }
        }
      `;

      const variables = { reference };
      const response = await this.hasuraService.executeQuery(query, variables);
      return response.mobile_payment_transactions[0] || null;
    } catch (error) {
      this.logger.error(
        'Failed to get mobile payment transaction by reference:',
        error
      );
      throw error;
    }
  }

  /**
   * Get mobile payment transactions with filters
   */
  async getTransactions(filters?: {
    provider?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<MobilePaymentTransaction[]> {
    try {
      let whereClause = '';
      const conditions: string[] = [];

      if (filters?.provider) {
        conditions.push(`provider: { _eq: "${filters.provider}" }`);
      }

      if (filters?.status) {
        conditions.push(`status: { _eq: "${filters.status}" }`);
      }

      if (filters?.startDate) {
        conditions.push(`created_at: { _gte: "${filters.startDate}" }`);
      }

      if (filters?.endDate) {
        conditions.push(`created_at: { _lte: "${filters.endDate}" }`);
      }

      if (conditions.length > 0) {
        whereClause = `(where: { ${conditions.join(', ')} })`;
      }

      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const query = `
        query GetMobilePaymentTransactions {
          mobile_payment_transactions${whereClause}(
            order_by: { created_at: desc }
            limit: ${limit}
            offset: ${offset}
          ) {
            id
            reference
            amount
            currency
            description
            provider
            payment_method
            status
            transaction_id
            account_id
            transaction_type
            customer_phone
            customer_email
            error_message
            error_code
            created_at
            updated_at
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query);
      return response.mobile_payment_transactions;
    } catch (error) {
      this.logger.error('Failed to get mobile payment transactions:', error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(filters?: {
    provider?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    total: number;
    pending: number;
    success: number;
    failed: number;
    cancelled: number;
    totalAmount: number;
  }> {
    try {
      let whereClause = '';
      const conditions: string[] = [];

      if (filters?.provider) {
        conditions.push(`provider: { _eq: "${filters.provider}" }`);
      }

      if (filters?.startDate) {
        conditions.push(`created_at: { _gte: "${filters.startDate}" }`);
      }

      if (filters?.endDate) {
        conditions.push(`created_at: { _lte: "${filters.endDate}" }`);
      }

      if (conditions.length > 0) {
        whereClause = `(where: { ${conditions.join(', ')} })`;
      }

      const query = `
        query GetMobilePaymentTransactionStats {
          mobile_payment_transactions_aggregate${whereClause} {
            aggregate {
              count
              sum {
                amount
              }
            }
            nodes {
              status
            }
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query);
      const aggregate =
        response.mobile_payment_transactions_aggregate.aggregate;
      const nodes = response.mobile_payment_transactions_aggregate.nodes;

      const stats = {
        total: aggregate.count,
        pending: 0,
        success: 0,
        failed: 0,
        cancelled: 0,
        totalAmount: aggregate.sum?.amount || 0,
      };

      // Count by status
      nodes.forEach((node: any) => {
        switch (node.status) {
          case 'pending':
            stats.pending++;
            break;
          case 'success':
            stats.success++;
            break;
          case 'failed':
            stats.failed++;
            break;
          case 'cancelled':
            stats.cancelled++;
            break;
        }
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to get transaction statistics:', error);
      throw error;
    }
  }

  /**
   * Log payment callback
   */
  async logCallback(transactionId: string, callbackData: any): Promise<void> {
    try {
      // First, find the transaction by reference or transaction_id
      let transaction = null;

      // Try to find by reference if it's a MyPVIT callback
      if (callbackData.merchantReferenceId) {
        transaction = await this.getTransactionByReference(
          callbackData.merchantReferenceId
        );
      }

      // If not found by reference, try to find by transaction_id
      if (!transaction && callbackData.transaction_id) {
        transaction = await this.getTransactionById(
          callbackData.transaction_id
        );
      }

      if (!transaction) {
        this.logger.warn(
          `Transaction not found for callback logging: ${transactionId}`
        );
        return;
      }

      const mutation = `
        mutation LogPaymentCallback($transactionId: uuid!, $callbackData: jsonb!) {
          insert_payment_callbacks_one(object: {
            transaction_id: $transactionId,
            callback_data: $callbackData,
            received_at: "now()"
          }) {
            id
          }
        }
      `;

      const variables = {
        transactionId: transaction.id, // Use our database UUID
        callbackData,
      };

      await this.hasuraService.executeMutation(mutation, variables);
      this.logger.log(
        `Payment callback logged for transaction: ${transaction.id}`
      );
    } catch (error) {
      this.logger.error('Failed to log payment callback:', error);
      // Don't throw error as this is just logging
    }
  }
}
