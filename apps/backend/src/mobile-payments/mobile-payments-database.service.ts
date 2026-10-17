import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { buildShortReferenceForMyPVit } from './providers/mypvit.service';
import { normalizeProviderMessage } from './normalize-provider-message';

export interface MobilePaymentTransaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
  provider: string;
  payment_method: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  transaction_id?: string;
  customer_phone?: string;
  customer_email?: string;
  error_message?: string;
  error_code?: string;
  account_id?: string;
  transaction_type: 'PAYMENT' | 'GIVE_CHANGE' | 'DEPOSIT';
  payment_entity?:
    | 'order'
    | 'account'
    | 'claim_order'
    | 'rental_booking'
    | 'order_cash_reconciliation'
    | 'order_deposit'
    | 'token'
    | 'reel_ai_token'
    | 'phone_verification';
  entity_id?: string;
  created_at: string;
  updated_at: string;
  /** #545 attempt tracking (only selected by the order-retry queries). */
  idempotency_key?: string | null;
  superseded_by_id?: string | null;
  superseded_reason?: string | null;
  superseded_at?: string | null;
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
  /** Provider reference (e.g. Freemopay `reference`) so callbacks can look up the row. */
  transaction_id?: string;
  transaction_type?: 'PAYMENT' | 'GIVE_CHANGE';
  payment_entity?:
    | 'order'
    | 'account'
    | 'claim_order'
    | 'rental_booking'
    | 'order_cash_reconciliation'
    | 'order_deposit'
    | 'token'
    | 'reel_ai_token'
    | 'phone_verification';
  entity_id?: string;
  /** Client Idempotency-Key for order payment retries (#545). Unique per entity_id. */
  idempotency_key?: string;
}

export interface UpdateTransactionData {
  status?: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  transaction_id?: string;
  /** May arrive as bilingual provider object; coerced to string before write. */
  error_message?: string | Record<string, unknown> | null;
  error_code?: string | null;
  superseded_by_id?: string | null;
  superseded_reason?: string | null;
  superseded_at?: string | null;
}

/** Columns that exist before the #545 migration (safe on hot paths during deploy). */
const LEGACY_TX_FIELDS = `
  id reference amount currency description provider payment_method status
  transaction_id customer_phone customer_email error_message error_code
  account_id transaction_type payment_entity entity_id created_at updated_at
`;

const ORDER_ATTEMPT_FIELDS = `
  id reference amount currency description provider payment_method status
  transaction_id customer_phone customer_email error_message error_code
  account_id transaction_type payment_entity entity_id created_at updated_at
  idempotency_key superseded_by_id superseded_reason superseded_at
`;

export interface PendingClaimOrderTransaction {
  id: string;
  entity_id: string;
  transaction_id?: string;
  provider?: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  created_at: string;
  account_id?: string;
  amount?: number;
  currency?: string;
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
            payment_entity
            created_at
            updated_at
            entity_id
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
            account_id
            transaction_type
            payment_entity
            entity_id
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
          ...(data.error_message !== undefined
            ? {
                error_message: normalizeProviderMessage(
                  data.error_message,
                  'Payment failed'
                ),
              }
            : {}),
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
            payment_entity
            customer_phone
            customer_email
            error_message
            error_code
            created_at
            updated_at
            entity_id
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
            payment_entity
            customer_phone
            customer_email
            error_message
            error_code
            created_at
            updated_at
            entity_id
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
   * Find MyPVIT transaction by short reference (from callback).
   * MyPVIT sends back a short reference (≤15 chars) but we store the long reference.
   * This method finds the transaction by matching the short reference against all pending MyPVIT transactions.
   */
  async findMyPVitTransactionByShortReference(
    shortReference: string
  ): Promise<MobilePaymentTransaction | null> {
    try {
      // Get recent pending transactions (last 24 hours) from MyPVIT providers
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      const query = `
        query FindMyPVitTransactionByShortRef($startDate: timestamptz!) {
          mobile_payment_transactions(
            where: {
              provider: { _eq: "mypvit" }
              created_at: { _gte: $startDate }
            }
            order_by: { created_at: desc }
            limit: 100
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
            payment_entity
            customer_phone
            customer_email
            error_message
            error_code
            created_at
            updated_at
            entity_id
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, {
        startDate: twentyFourHoursAgo.toISOString(),
      });
      
      const transactions = response.mobile_payment_transactions || [];
      
      // Find the transaction whose long reference generates the matching short reference
      for (const tx of transactions) {
        const derivedShortRef = buildShortReferenceForMyPVit(tx.reference);
        if (derivedShortRef === shortReference) {
          return tx;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(
        'Failed to find MyPVIT transaction by short reference:',
        error
      );
      throw error;
    }
  }

  /**
   * Get a mobile payment transaction by external transaction_id (provider reference)
   */
  async getTransactionByTransactionId(
    transactionId: string
  ): Promise<MobilePaymentTransaction | null> {
    try {
      const query = `
        query GetMobilePaymentTransactionByTransactionId($transactionId: String!) {
          mobile_payment_transactions(
            where: { transaction_id: { _eq: $transactionId } }
            limit: 1
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
            payment_entity
            customer_phone
            customer_email
            error_message
            error_code
            created_at
            updated_at
            entity_id
          }
        }
      `;

      const response = await this.hasuraService.executeQuery<{
        mobile_payment_transactions: MobilePaymentTransaction[];
      }>(query, { transactionId });
      const rows = response.mobile_payment_transactions ?? [];
      return rows[0] ?? null;
    } catch (error) {
      this.logger.error(
        'Failed to get mobile payment transaction by transaction_id:',
        error
      );
      throw error;
    }
  }

  /**
   * Get order_number (entity_id) values for orders that have a pending claim_order
   * mobile payment. Used to exclude such orders from GET /orders/open.
   */
  async getOrderNumbersWithPendingClaimOrder(): Promise<string[]> {
    try {
      const query = `
        query GetOrderNumbersWithPendingClaimOrder {
          mobile_payment_transactions(
            where: {
              payment_entity: { _eq: claim_order }
              status: { _eq: "pending" }
              entity_id: { _is_null: false }
            }
          ) {
            entity_id
          }
        }
      `;
      const response = await this.hasuraService.executeQuery<{
        mobile_payment_transactions: Array<{ entity_id: string | null }>;
      }>(query);
      const rows = response.mobile_payment_transactions ?? [];
      return rows
        .map((r) => r.entity_id)
        .filter((id): id is string => id != null && id !== '');
    } catch (error) {
      this.logger.error(
        'Failed to get order numbers with pending claim order:',
        error
      );
      throw error;
    }
  }

  /**
   * Check if there is a pending claim_order mobile payment for the given order
   * number. Used to block claimOrder / claimOrderWithTopup when another agent
   * has already initiated claim-with-topup.
   */
  async hasPendingClaimOrderForOrderNumber(
    orderNumber: string
  ): Promise<boolean> {
    try {
      const query = `
        query HasPendingClaimOrderForOrderNumber($orderNumber: String!) {
          mobile_payment_transactions(
            where: {
              payment_entity: { _eq: claim_order }
              status: { _eq: "pending" }
              entity_id: { _eq: $orderNumber }
            }
            limit: 1
          ) {
            id
          }
        }
      `;
      const response = await this.hasuraService.executeQuery<{
        mobile_payment_transactions: Array<{ id: string }>;
      }>(query, { orderNumber });
      const rows = response.mobile_payment_transactions ?? [];
      return rows.length > 0;
    } catch (error) {
      this.logger.error(
        'Failed to check pending claim order for order number:',
        error
      );
      throw error;
    }
  }

  /**
   * Get the latest in-flight order payment transaction by order number (pending or processing).
   * Uses entity_id to support multiple retry attempts with unique references.
   */
  async getPendingOrderPaymentTransactionByOrderNumber(
    orderNumber: string
  ): Promise<MobilePaymentTransaction | null> {
    const query = `
      query GetPendingOrderPaymentTransactionByOrderNumber($orderNumber: String!) {
        mobile_payment_transactions(
          where: {
            payment_entity: { _eq: order }
            status: { _in: ["pending", "processing"] }
            entity_id: { _eq: $orderNumber }
          }
          order_by: { created_at: desc }
          limit: 1
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
          account_id
          transaction_type
          payment_entity
          entity_id
          created_at
          updated_at
        }
      }
    `;
    const response = await this.hasuraService.executeQuery<{
      mobile_payment_transactions: MobilePaymentTransaction[];
    }>(query, { orderNumber });
    return response.mobile_payment_transactions?.[0] ?? null;
  }

  /**
   * Conditional update (compare-and-set on status). Returns true only when this call
   * moved the row; false means another writer changed the status first.
   */
  async updateTransactionIfStatus(
    id: string,
    expectedStatus: MobilePaymentTransaction['status'],
    data: UpdateTransactionData
  ): Promise<boolean> {
    const response = await this.hasuraService.executeMutation<{
      update_mobile_payment_transactions: { affected_rows: number };
    }>(
      `mutation CasMobilePaymentTransaction($id: uuid!, $expected: String!, $data: mobile_payment_transactions_set_input!) {
        update_mobile_payment_transactions(
          where: { id: { _eq: $id }, status: { _eq: $expected } }
          _set: $data
        ) { affected_rows }
      }`,
      {
        id,
        expected: expectedStatus,
        data: {
          ...data,
          ...(data.error_message !== undefined
            ? {
                error_message: normalizeProviderMessage(
                  data.error_message,
                  'Payment failed'
                ),
              }
            : {}),
          updated_at: new Date().toISOString(),
        },
      }
    );
    return (response.update_mobile_payment_transactions?.affected_rows ?? 0) > 0;
  }

  /** Retry-created order payment attempts since `sinceIso` (rate limit, #545). */
  async countOrderRetryAttemptsSince(
    orderNumber: string,
    sinceIso: string,
    descriptionMarker: string
  ): Promise<number> {
    const response = await this.hasuraService.executeQuery<{
      mobile_payment_transactions_aggregate: { aggregate: { count: number } };
    }>(
      `query CountOrderRetryAttempts($orderNumber: String!, $since: timestamptz!, $like: String!) {
        mobile_payment_transactions_aggregate(
          where: {
            payment_entity: { _eq: order }
            entity_id: { _eq: $orderNumber }
            created_at: { _gte: $since }
            description: { _like: $like }
          }
        ) { aggregate { count } }
      }`,
      { orderNumber, since: sinceIso, like: `%${descriptionMarker}%` }
    );
    return response.mobile_payment_transactions_aggregate?.aggregate?.count ?? 0;
  }

  /**
   * Retry-created order attempts since `sinceIso` for a payer user or a target number
   * (#545 QA F3 caps). Returns the count and the newest created_at.
   */
  async summarizeRetryAttemptsSince(params: {
    sinceIso: string;
    descriptionMarker: string;
    userId?: string;
    phones?: string[];
  }): Promise<{ count: number; latestAt: string | null }> {
    const where: Record<string, unknown> = {
      payment_entity: { _eq: 'order' },
      created_at: { _gte: params.sinceIso },
      description: { _like: `%${params.descriptionMarker}%` },
    };
    if (params.userId) where.account = { user_id: { _eq: params.userId } };
    if (params.phones) where.customer_phone = { _in: params.phones };
    const response = await this.hasuraService.executeQuery<{
      mobile_payment_transactions_aggregate: {
        aggregate: { count: number; max: { created_at: string | null } | null };
      };
    }>(
      `query SummarizeRetryAttempts($where: mobile_payment_transactions_bool_exp!) {
        mobile_payment_transactions_aggregate(where: $where) {
          aggregate { count max { created_at } }
        }
      }`,
      { where }
    );
    const agg = response.mobile_payment_transactions_aggregate?.aggregate;
    return { count: agg?.count ?? 0, latestAt: agg?.max?.created_at ?? null };
  }

  /** Order attempt created with this Idempotency-Key since `sinceIso`, if any. */
  async getOrderTransactionByIdempotencyKey(
    orderNumber: string,
    idempotencyKey: string,
    sinceIso: string
  ): Promise<MobilePaymentTransaction | null> {
    const response = await this.hasuraService.executeQuery<{
      mobile_payment_transactions: MobilePaymentTransaction[];
    }>(
      `query OrderTxByIdempotencyKey($orderNumber: String!, $key: String!, $since: timestamptz!) {
        mobile_payment_transactions(
          where: {
            payment_entity: { _eq: order }
            entity_id: { _eq: $orderNumber }
            idempotency_key: { _eq: $key }
            created_at: { _gte: $since }
          }
          limit: 1
        ) { ${ORDER_ATTEMPT_FIELDS} }
      }`,
      { orderNumber, key: idempotencyKey, since: sinceIso }
    );
    return response.mobile_payment_transactions?.[0] ?? null;
  }

  /** All order payment attempts for an order with the given status. */
  async listOrderTransactionsByStatus(
    orderNumber: string,
    status: MobilePaymentTransaction['status']
  ): Promise<MobilePaymentTransaction[]> {
    const response = await this.hasuraService.executeQuery<{
      mobile_payment_transactions: MobilePaymentTransaction[];
    }>(
      `query OrderTxsByStatus($orderNumber: String!, $status: String!) {
        mobile_payment_transactions(
          where: {
            payment_entity: { _eq: order }
            entity_id: { _eq: $orderNumber }
            status: { _eq: $status }
          }
          order_by: { created_at: asc }
        ) { ${LEGACY_TX_FIELDS} }
      }`,
      { orderNumber, status }
    );
    return response.mobile_payment_transactions ?? [];
  }

  /** The attempt this attempt replaced, if any (for idempotent replays). */
  async getTransactionSupersededBy(
    newTransactionId: string
  ): Promise<MobilePaymentTransaction | null> {
    const response = await this.hasuraService.executeQuery<{
      mobile_payment_transactions: MobilePaymentTransaction[];
    }>(
      `query TxSupersededBy($id: uuid!) {
        mobile_payment_transactions(where: { superseded_by_id: { _eq: $id } }, limit: 1) {
          ${ORDER_ATTEMPT_FIELDS}
        }
      }`,
      { id: newTransactionId }
    );
    return response.mobile_payment_transactions?.[0] ?? null;
  }

  /**
   * Pending cash-exception reconciliation collection for an order (by order number in entity_id).
   */
  async getPendingCashReconciliationTransactionByOrderNumber(
    orderNumber: string
  ): Promise<MobilePaymentTransaction | null> {
    const query = `
      query GetPendingCashReconciliationTx($orderNumber: String!) {
        mobile_payment_transactions(
          where: {
            payment_entity: { _eq: order_cash_reconciliation }
            status: { _eq: "pending" }
            entity_id: { _eq: $orderNumber }
          }
          order_by: { created_at: desc }
          limit: 1
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
          account_id
          transaction_type
          payment_entity
          entity_id
          created_at
          updated_at
        }
      }
    `;
    const response = await this.hasuraService.executeQuery<{
      mobile_payment_transactions: MobilePaymentTransaction[];
    }>(query, { orderNumber });
    return response.mobile_payment_transactions?.[0] ?? null;
  }

  /**
   * Check if there is a pending rental_booking mobile payment for the given booking number.
   * Used to prevent duplicate booking confirmation payment initiation.
   */
  async hasPendingRentalBookingPayment(
    bookingNumber: string
  ): Promise<boolean> {
    try {
      const query = `
        query HasPendingRentalBookingPayment($bookingNumber: String!) {
          mobile_payment_transactions(
            where: {
              payment_entity: { _eq: rental_booking }
              status: { _eq: "pending" }
              entity_id: { _eq: $bookingNumber }
            }
            limit: 1
          ) {
            id
          }
        }
      `;

      const response = await this.hasuraService.executeQuery<{
        mobile_payment_transactions: Array<{ id: string }>;
      }>(query, { bookingNumber });

      const rows = response.mobile_payment_transactions ?? [];
      return rows.length > 0;
    } catch (error) {
      this.logger.error(
        'Failed to check pending rental booking payment:',
        error
      );
      throw error;
    }
  }

  /**
   * Get pending claim_order transactions for a specific customer email.
   * Used to include claim-in-progress orders in agent /orders responses.
   */
  async getPendingClaimOrderTransactionsByCustomerEmail(
    customerEmail: string
  ): Promise<PendingClaimOrderTransaction[]> {
    try {
      const query = `
        query GetPendingClaimOrderTransactionsByCustomerEmail($customerEmail: String!) {
          mobile_payment_transactions(
            where: {
              payment_entity: { _eq: claim_order }
              status: { _eq: "pending" }
              customer_email: { _eq: $customerEmail }
              entity_id: { _is_null: false }
            }
            order_by: { created_at: desc }
          ) {
            id
            entity_id
            transaction_id
            provider
            status
            created_at
            account_id
          }
        }
      `;
      const response = await this.hasuraService.executeQuery<{
        mobile_payment_transactions: PendingClaimOrderTransaction[];
      }>(query, { customerEmail });
      return response.mobile_payment_transactions ?? [];
    } catch (error) {
      this.logger.error(
        'Failed to get pending claim order transactions for customer email:',
        error
      );
      throw error;
    }
  }

  /**
   * Get a single pending claim_order transaction for customer email + order number.
   * Used by order claim cancellation flow.
   */
  async getPendingClaimOrderTransactionByCustomerEmailAndOrderNumber(
    customerEmail: string,
    orderNumber: string
  ): Promise<PendingClaimOrderTransaction | null> {
    try {
      const query = `
        query GetPendingClaimOrderTransactionByCustomerEmailAndOrderNumber(
          $customerEmail: String!
          $orderNumber: String!
        ) {
          mobile_payment_transactions(
            where: {
              payment_entity: { _eq: claim_order }
              status: { _eq: "pending" }
              customer_email: { _eq: $customerEmail }
              entity_id: { _eq: $orderNumber }
            }
            order_by: { created_at: desc }
            limit: 1
          ) {
            id
            entity_id
            transaction_id
            provider
            status
            created_at
            account_id
          }
        }
      `;
      const response = await this.hasuraService.executeQuery<{
        mobile_payment_transactions: PendingClaimOrderTransaction[];
      }>(query, { customerEmail, orderNumber });
      const rows = response.mobile_payment_transactions ?? [];
      return rows[0] ?? null;
    } catch (error) {
      this.logger.error(
        'Failed to get pending claim order transaction by customer email and order number:',
        error
      );
      throw error;
    }
  }

  /**
   * Pending claim_order transactions for an agent user (via account.user_id).
   * Prefer this when users.email may be null.
   */
  async getPendingClaimOrderTransactionsForUserId(
    userId: string
  ): Promise<PendingClaimOrderTransaction[]> {
    try {
      const query = `
        query GetPendingClaimOrderTransactionsForUser($userId: uuid!) {
          mobile_payment_transactions(
            where: {
              payment_entity: { _eq: claim_order }
              status: { _eq: "pending" }
              entity_id: { _is_null: false }
              account: { user_id: { _eq: $userId } }
            }
            order_by: { created_at: desc }
          ) {
            id
            entity_id
            transaction_id
            provider
            status
            created_at
            account_id
          }
        }
      `;
      const response = await this.hasuraService.executeQuery<{
        mobile_payment_transactions: PendingClaimOrderTransaction[];
      }>(query, { userId });
      return response.mobile_payment_transactions ?? [];
    } catch (error) {
      this.logger.error(
        'Failed to get pending claim order transactions for user:',
        error
      );
      throw error;
    }
  }

  async getPendingClaimOrderTransactionForUserAndOrderNumber(
    userId: string,
    orderNumber: string
  ): Promise<PendingClaimOrderTransaction | null> {
    try {
      const query = `
        query GetPendingClaimForUserOrder(
          $userId: uuid!
          $orderNumber: String!
        ) {
          mobile_payment_transactions(
            where: {
              payment_entity: { _eq: claim_order }
              status: { _eq: "pending" }
              entity_id: { _eq: $orderNumber }
              account: { user_id: { _eq: $userId } }
            }
            order_by: { created_at: desc }
            limit: 1
          ) {
            id
            entity_id
            transaction_id
            provider
            status
            created_at
            account_id
            amount
            currency
          }
        }
      `;
      const response = await this.hasuraService.executeQuery<{
        mobile_payment_transactions: PendingClaimOrderTransaction[];
      }>(query, { userId, orderNumber });
      const rows = response.mobile_payment_transactions ?? [];
      return rows[0] ?? null;
    } catch (error) {
      this.logger.error(
        'Failed to get pending claim order transaction for user and order:',
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
            payment_entity
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
   * Pending or processing GIVE_CHANGE withdrawals for wallet reconcile / cron.
   */
  async getPendingGiveChangeWithdrawals(options?: {
    limit?: number;
    offset?: number;
  }): Promise<MobilePaymentTransaction[]> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    const query = `
      query GetPendingGiveChangeWithdrawals {
        mobile_payment_transactions(
          where: {
            status: { _eq: "pending" }
            transaction_type: { _eq: "GIVE_CHANGE" }
          }
          order_by: { created_at: asc }
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
          payment_entity
          customer_phone
          customer_email
          error_message
          error_code
          created_at
          updated_at
          entity_id
        }
      }
    `;
    try {
      const response = await this.hasuraService.executeQuery(query);
      return response.mobile_payment_transactions;
    } catch (error) {
      this.logger.error('Failed to get pending GIVE_CHANGE withdrawals:', error);
      throw error;
    }
  }

  /**
   * Pending or processing MyPVit / Freemopay rows for admin reconciliation.
   */
  async getPendingIntegrationTransactions(options?: {
    limit?: number;
    offset?: number;
  }): Promise<MobilePaymentTransaction[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const query = `
      query GetPendingIntegrationMobilePayments {
        mobile_payment_transactions(
          where: {
            status: { _in: ["pending", "processing"] }
          }
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
          payment_entity
          customer_phone
          customer_email
          error_message
          error_code
          created_at
          updated_at
          entity_id
        }
      }
    `;
    try {
      const response = await this.hasuraService.executeQuery(query);
      return response.mobile_payment_transactions;
    } catch (error) {
      this.logger.error('Failed to get pending integration transactions:', error);
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
      if (!transaction) {
        transaction = await this.getTransactionById(transactionId);
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

  async getTransactionsByAccountAndEntity(
    accountId: string,
    paymentEntity: string,
    limit = 20,
    offset = 0
  ): Promise<MobilePaymentTransaction[]> {
    const query = `
      query GetTransactionsByAccountAndEntity($accountId: uuid!, $paymentEntity: String!, $limit: Int!, $offset: Int!) {
        mobile_payment_transactions(
          where: {
            account_id: { _eq: $accountId }
            payment_entity: { _eq: $paymentEntity }
          }
          order_by: { created_at: desc }
          limit: $limit
          offset: $offset
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
          payment_entity
          customer_phone
          customer_email
          error_message
          error_code
          created_at
          updated_at
        }
      }
    `;
    const response = await this.hasuraService.executeQuery<{
      mobile_payment_transactions: MobilePaymentTransaction[];
    }>(query, { accountId, paymentEntity, limit, offset });
    return response.mobile_payment_transactions ?? [];
  }

  /**
   * Check if a wallet deposit exists for this mobile payment transaction.
   * Used to determine if a stuck processing row was actually credited.
   */
  async hasWalletDepositForTransaction(transactionId: string): Promise<boolean> {
    const query = `
      query CheckWalletDeposit($idempotencyKey: String!) {
        account_transactions(
          where: {
            idempotency_key: { _eq: $idempotencyKey }
            transaction_type: { _eq: "deposit" }
          }
          limit: 1
        ) {
          id
        }
      }
    `;
    const response = await this.hasuraService.executeQuery<{
      account_transactions: Array<{ id: string }>;
    }>(query, { idempotencyKey: `momo-deposit:${transactionId}` });
    return (response.account_transactions?.length ?? 0) > 0;
  }
}
