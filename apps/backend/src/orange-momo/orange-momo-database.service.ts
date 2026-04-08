import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';

export interface OrangePaymentRequestLog {
  userId: string;
  transactionId: string;
  externalId: string;
  amount: number;
  currency: string;
  status: string;
  payerMessage?: string;
  payeeNote?: string;
}

interface InsertOrangePaymentRequestResult {
  insert_orange_momo_payment_requests_one: {
    id: string;
    transaction_id: string;
    external_id: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
  };
}

interface UpdateOrangePaymentRequestResult {
  update_orange_momo_payment_requests: {
    affected_rows: number;
  };
}

interface GetOrangePaymentByTransactionIdResult {
  orange_momo_payment_requests: Array<{
    id: string;
    user_id: string;
    transaction_id: string;
    external_id: string;
    amount: number;
    currency: string;
    status: string;
    payer_message: string;
    payee_note: string;
    created_at: string;
    updated_at: string;
  }>;
}

@Injectable()
export class OrangeMomoDatabaseService {
  private readonly logger = new Logger(OrangeMomoDatabaseService.name);
  private readonly graphqlClient: GraphQLClient;

  constructor(private configService: ConfigService) {
    const hasuraEndpoint = this.configService.get<string>(
      'HASURA_GRAPHQL_ENDPOINT'
    );
    const adminSecret = this.configService.get<string>(
      'HASURA_GRAPHQL_ADMIN_SECRET'
    );

    this.graphqlClient = new GraphQLClient(
      hasuraEndpoint || 'http://localhost:8080/v1/graphql',
      {
        headers: {
          'x-hasura-admin-secret': adminSecret || 'myadminsecretkey',
        },
      }
    );
  }

  async logPaymentRequest(log: OrangePaymentRequestLog): Promise<void> {
    try {
      const mutation = `
        mutation InsertOrangePaymentRequest($object: orange_momo_payment_requests_insert_input!) {
          insert_orange_momo_payment_requests_one(object: $object) {
            id
            transaction_id
            external_id
            amount
            currency
            status
            created_at
          }
        }
      `;

      const variables = {
        object: {
          user_id: log.userId,
          transaction_id: log.transactionId,
          external_id: log.externalId,
          amount: log.amount,
          currency: log.currency,
          status: log.status,
          payer_message: log.payerMessage,
          payee_note: log.payeeNote,
        },
      };

      const result =
        await this.graphqlClient.request<InsertOrangePaymentRequestResult>(
          mutation,
          variables
        );

      this.logger.log(
        `Orange payment request logged: ${result.insert_orange_momo_payment_requests_one.id}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to log Orange payment request: ${(error as Error).message}`
      );
      throw error;
    }
  }

  async updatePaymentRequestStatus(
    transactionId: string,
    status: string
  ): Promise<void> {
    try {
      const mutation = `
        mutation UpdateOrangePaymentRequestStatus($transactionId: String!, $status: String!) {
          update_orange_momo_payment_requests(
            where: {transaction_id: {_eq: $transactionId}},
            _set: {status: $status, updated_at: "now()"}
          ) {
            affected_rows
          }
        }
      `;

      await this.graphqlClient.request<UpdateOrangePaymentRequestResult>(
        mutation,
        { transactionId, status }
      );
    } catch (error) {
      this.logger.error(
        `Failed to update Orange payment status: ${(error as Error).message}`
      );
      throw error;
    }
  }

  async getPaymentRequestByTransactionId(
    transactionId: string
  ): Promise<GetOrangePaymentByTransactionIdResult['orange_momo_payment_requests'][0] | null> {
    try {
      const query = `
        query GetOrangePaymentByTransactionId($transactionId: String!) {
          orange_momo_payment_requests(
            where: {transaction_id: {_eq: $transactionId}},
            limit: 1
          ) {
            id
            user_id
            transaction_id
            external_id
            amount
            currency
            status
            payer_message
            payee_note
            created_at
            updated_at
          }
        }
      `;

      const result =
        await this.graphqlClient.request<GetOrangePaymentByTransactionIdResult>(
          query,
          { transactionId }
        );

      return result.orange_momo_payment_requests[0] || null;
    } catch (error) {
      this.logger.error(
        `Failed to get Orange payment by transaction id: ${
          (error as Error).message
        }`
      );
      throw error;
    }
  }
}
