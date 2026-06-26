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

export interface StripeEventRecordResult {
  shouldProcess: boolean;
  duplicate: boolean;
}

interface StripeEventRow {
  processed_at: string | null;
}

interface StripeEventByIdResponse {
  stripe_events: StripeEventRow[];
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
    data: CreateStripeTransactionData,
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
    data: UpdateStripeTransactionData,
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
    id: string,
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
    reference: string,
  ): Promise<StripePaymentTransaction | null> {
    return this.getTransactionByField('reference', reference);
  }

  async getTransactionBySessionId(
    sessionId: string,
  ): Promise<StripePaymentTransaction | null> {
    return this.getTransactionByField('stripe_session_id', sessionId);
  }

  async getTransactionByPaymentIntentId(
    paymentIntentId: string,
  ): Promise<StripePaymentTransaction | null> {
    return this.getTransactionByField(
      'stripe_payment_intent_id',
      paymentIntentId,
    );
  }

  private async getTransactionByField(
    field: string,
    value: string,
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
   * Insert the event idempotency row. Previously seen but unprocessed events
   * must still run so Stripe retries can recover from transient failures.
   */
  async recordEvent(
    eventId: string,
    eventType: string,
    source: 'payments' | 'connect',
    payload: unknown,
  ): Promise<StripeEventRecordResult> {
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
    if (response.insert_stripe_events_one?.id) {
      return { shouldProcess: true, duplicate: false };
    }
    const existing = await this.getEventByEventId(eventId);
    return {
      shouldProcess: !existing?.processed_at,
      duplicate: true,
    };
  }

  private async getEventByEventId(
    eventId: string,
  ): Promise<StripeEventRow | null> {
    const query = `
      query GetStripeEventByEventId($eventId: String!) {
        stripe_events(where: { event_id: { _eq: $eventId } }, limit: 1) {
          processed_at
        }
      }
    `;
    const response =
      await this.hasuraService.executeQuery<StripeEventByIdResponse>(query, {
        eventId,
      });
    return response.stripe_events?.[0] || null;
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
}
