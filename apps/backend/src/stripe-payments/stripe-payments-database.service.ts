import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type StripePaymentEntity =
  | 'order'
  | 'account'
  | 'claim_order'
  | 'rental_booking'
  | 'order_cash_reconciliation';

export type StripeTransactionStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'disputed';

export interface StripePaymentTransaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  description?: string;
  status: StripeTransactionStatus;
  transaction_type: 'PAYMENT' | 'GIVE_CHANGE';
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  payment_url?: string;
  account_id?: string;
  payment_entity?: StripePaymentEntity;
  entity_id?: string;
  customer_email?: string;
  error_message?: string;
  error_code?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStripeTransactionData {
  reference: string;
  amount: number;
  currency: string;
  description?: string;
  account_id?: string;
  transaction_type?: 'PAYMENT' | 'GIVE_CHANGE';
  payment_entity?: StripePaymentEntity;
  entity_id?: string;
  customer_email?: string;
  success_url?: string;
  cancel_url?: string;
}

export interface UpdateStripeTransactionData {
  status?: StripeTransactionStatus;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  payment_url?: string;
  error_message?: string;
  error_code?: string;
}

const TRANSACTION_FIELDS = `
  id
  reference
  amount
  currency
  description
  status
  transaction_type
  stripe_session_id
  stripe_payment_intent_id
  payment_url
  account_id
  payment_entity
  entity_id
  customer_email
  error_message
  error_code
  created_at
  updated_at
`;

@Injectable()
export class StripePaymentsDatabaseService {
  constructor(private readonly hasuraService: HasuraSystemService) {}

  async createTransaction(
    data: CreateStripeTransactionData
  ): Promise<StripePaymentTransaction> {
    const mutation = `
      mutation CreateStripePaymentTransaction($data: stripe_payment_transactions_insert_input!) {
        insert_stripe_payment_transactions_one(object: $data) {
          ${TRANSACTION_FIELDS}
        }
      }
    `;
    const response = await this.hasuraService.executeMutation(mutation, {
      data: { ...data, status: 'pending' },
    });
    return response.insert_stripe_payment_transactions_one;
  }

  async updateTransaction(
    id: string,
    data: UpdateStripeTransactionData
  ): Promise<StripePaymentTransaction> {
    const mutation = `
      mutation UpdateStripePaymentTransaction(
        $id: uuid!
        $data: stripe_payment_transactions_set_input!
      ) {
        update_stripe_payment_transactions_by_pk(pk_columns: { id: $id }, _set: $data) {
          ${TRANSACTION_FIELDS}
        }
      }
    `;
    const response = await this.hasuraService.executeMutation(mutation, {
      id,
      data,
    });
    return response.update_stripe_payment_transactions_by_pk;
  }

  async getTransactionById(
    id: string
  ): Promise<StripePaymentTransaction | null> {
    const query = `
      query GetStripeTransactionById($id: uuid!) {
        stripe_payment_transactions_by_pk(id: $id) { ${TRANSACTION_FIELDS} }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { id });
    return response.stripe_payment_transactions_by_pk || null;
  }

  async getTransactionByReference(
    reference: string
  ): Promise<StripePaymentTransaction | null> {
    return this.getTransactionByField('reference', reference);
  }

  async getTransactionBySessionId(
    sessionId: string
  ): Promise<StripePaymentTransaction | null> {
    return this.getTransactionByField('stripe_session_id', sessionId);
  }

  async getTransactionByPaymentIntentId(
    paymentIntentId: string
  ): Promise<StripePaymentTransaction | null> {
    return this.getTransactionByField(
      'stripe_payment_intent_id',
      paymentIntentId
    );
  }

  private async getTransactionByField(
    field: string,
    value: string
  ): Promise<StripePaymentTransaction | null> {
    const query = `
      query GetStripeTransactionByField($value: String!) {
        stripe_payment_transactions(
          where: { ${field}: { _eq: $value } }
          limit: 1
        ) { ${TRANSACTION_FIELDS} }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { value });
    return (response.stripe_payment_transactions || [])[0] || null;
  }

  async getTransactionByEntityId(
    entityId: string
  ): Promise<StripePaymentTransaction | null> {
    return this.getTransactionByField('entity_id', entityId);
  }

  async listTransactions(filters: {
    accountId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<StripePaymentTransaction[]> {
    const where: Record<string, unknown> = {};
    if (filters.accountId) where.account_id = { _eq: filters.accountId };
    if (filters.status) where.status = { _eq: filters.status };
    const query = `
      query ListStripeTransactions(
        $where: stripe_payment_transactions_bool_exp
        $limit: Int!
        $offset: Int!
      ) {
        stripe_payment_transactions(
          where: $where
          order_by: { created_at: desc }
          limit: $limit
          offset: $offset
        ) { ${TRANSACTION_FIELDS} }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, {
      where,
      limit: filters.limit ?? 20,
      offset: filters.offset ?? 0,
    });
    return response.stripe_payment_transactions || [];
  }

  /**
   * Insert an event row, returning true only when this event is new. Relies on
   * the unique constraint on event_id for idempotent webhook processing.
   */
  async recordEvent(
    eventId: string,
    eventType: string,
    source: 'payments' | 'connect',
    payload: unknown
  ): Promise<boolean> {
    const mutation = `
      mutation RecordStripeEvent($data: stripe_events_insert_input!) {
        insert_stripe_events_one(
          object: $data
          on_conflict: {
            constraint: stripe_events_event_id_key
            update_columns: []
          }
        ) {
          id
        }
      }
    `;
    const response = await this.hasuraService.executeMutation(mutation, {
      data: {
        event_id: eventId,
        event_type: eventType,
        source,
        payload,
      },
    });
    // Hasura returns null on ON CONFLICT DO NOTHING, so a non-null row means
    // this event was newly inserted (i.e. not previously seen).
    return !!response.insert_stripe_events_one?.id;
  }

  async markEventProcessed(eventId: string): Promise<void> {
    const mutation = `
      mutation MarkStripeEventProcessed($eventId: String!) {
        update_stripe_events(
          where: { event_id: { _eq: $eventId } }
          _set: { processed_at: "now()" }
        ) {
          affected_rows
        }
      }
    `;
    await this.hasuraService.executeMutation(mutation, { eventId });
  }

  async createRefundRecord(data: {
    stripe_refund_id?: string;
    stripe_payment_intent_id: string;
    stripe_payment_transaction_id?: string;
    order_id: string;
    amount: number;
    currency: string;
    reason?: string;
    cancellation_fee: number;
    cancelled_by: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const mutation = `
      mutation CreateStripeRefund($data: stripe_refunds_insert_input!) {
        insert_stripe_refunds_one(object: $data) {
          id
        }
      }
    `;
    const response = await this.hasuraService.executeMutation(mutation, { data });
    return response.insert_stripe_refunds_one;
  }

  async updateRefundByStripeId(
    stripeRefundId: string,
    data: {
      status?: string;
      failure_reason?: string;
    }
  ): Promise<{ id: string } | null> {
    const mutation = `
      mutation UpdateStripeRefund($stripeRefundId: String!, $data: stripe_refunds_set_input!) {
        update_stripe_refunds(
          where: { stripe_refund_id: { _eq: $stripeRefundId } }
          _set: $data
        ) {
          returning {
            id
          }
        }
      }
    `;
    const response = await this.hasuraService.executeMutation(mutation, {
      stripeRefundId,
      data,
    });
    return (response.update_stripe_refunds?.returning || [])[0] || null;
  }

  async getRefundByStripeId(stripeRefundId: string): Promise<{
    id: string;
    status: string;
    amount: number;
  } | null> {
    const query = `
      query GetStripeRefund($stripeRefundId: String!) {
        stripe_refunds(where: { stripe_refund_id: { _eq: $stripeRefundId } }, limit: 1) {
          id
          status
          amount
        }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { stripeRefundId });
    return (response.stripe_refunds || [])[0] || null;
  }

  async listRefundsForOrder(orderId: string): Promise<Array<{
    id: string;
    stripe_refund_id: string;
    amount: number;
    currency: string;
    status: string;
    cancellation_fee: number;
    cancelled_by: string;
    created_at: string;
  }>> {
    const query = `
      query ListRefundsForOrder($orderId: uuid!) {
        stripe_refunds(
          where: { order_id: { _eq: $orderId } }
          order_by: { created_at: desc }
        ) {
          id
          stripe_refund_id
          amount
          currency
          status
          cancellation_fee
          cancelled_by
          created_at
        }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { orderId });
    return response.stripe_refunds || [];
  }
}
