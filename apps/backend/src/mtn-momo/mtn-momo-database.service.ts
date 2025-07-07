import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';

export interface PaymentRequestLog {
  userId: string;
  transactionId: string;
  externalId: string;
  amount: number;
  currency: string;
  status: string;
  payerMessage?: string;
  payeeNote?: string;
}

@Injectable()
export class MtnMomoDatabaseService {
  private readonly logger = new Logger(MtnMomoDatabaseService.name);
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

  /**
   * Log a payment request to the database
   */
  async logPaymentRequest(log: PaymentRequestLog): Promise<void> {
    try {
      const mutation = `
        mutation InsertPaymentRequest($object: mtn_momo_payment_requests_insert_input!) {
          insert_mtn_momo_payment_requests_one(object: $object) {
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

      const result = await this.graphqlClient.request(mutation, variables);

      this.logger.log(
        `Payment request logged successfully: ${result.insert_mtn_momo_payment_requests_one.id}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to log payment request: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Update payment request status
   */
  async updatePaymentRequestStatus(
    transactionId: string,
    status: string
  ): Promise<void> {
    try {
      const mutation = `
        mutation UpdatePaymentRequestStatus($transactionId: String!, $status: String!) {
          update_mtn_momo_payment_requests(
            where: {transaction_id: {_eq: $transactionId}}, 
            _set: {status: $status, updated_at: "now()"}
          ) {
            affected_rows
          }
        }
      `;

      const variables = {
        transactionId,
        status,
      };

      const result = await this.graphqlClient.request(mutation, variables);

      this.logger.log(
        `Payment request status updated: ${result.update_mtn_momo_payment_requests.affected_rows} rows affected`
      );
    } catch (error) {
      this.logger.error(
        `Failed to update payment request status: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Get payment requests for a user
   */
  async getUserPaymentRequests(userId: string): Promise<any[]> {
    try {
      const query = `
        query GetUserPaymentRequests($userId: uuid!) {
          mtn_momo_payment_requests(
            where: {user_id: {_eq: $userId}}, 
            order_by: {created_at: desc}
          ) {
            id
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

      const variables = {
        userId,
      };

      const result = await this.graphqlClient.request(query, variables);

      return result.mtn_momo_payment_requests;
    } catch (error) {
      this.logger.error(
        `Failed to get user payment requests: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Get payment request by transaction ID
   */
  async getPaymentRequestByTransactionId(transactionId: string): Promise<any> {
    try {
      const query = `
        query GetPaymentRequestByTransactionId($transactionId: String!) {
          mtn_momo_payment_requests(
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

      const variables = {
        transactionId,
      };

      const result = await this.graphqlClient.request(query, variables);

      return result.mtn_momo_payment_requests[0] || null;
    } catch (error) {
      this.logger.error(
        `Failed to get payment request by transaction ID: ${
          (error as Error).message
        }`
      );
      throw error;
    }
  }
}
