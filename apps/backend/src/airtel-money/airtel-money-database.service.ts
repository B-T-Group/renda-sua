import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

@Injectable()
export class AirtelMoneyDatabaseService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Log payment request to database
   */
  async logPaymentRequest(
    userId: string,
    transactionId: string,
    reference: string,
    amount: string,
    currency: string,
    status: string,
    message: string,
    notes: string = ''
  ): Promise<void> {
    const mutation = `
      mutation LogAirtelMoneyPayment(
        $userId: uuid!,
        $transactionId: String!,
        $reference: String!,
        $amount: String!,
        $currency: String!,
        $status: String!,
        $message: String!,
        $notes: String!
      ) {
        insert_airtel_money_payments_one(object: {
          user_id: $userId,
          transaction_id: $transactionId,
          reference: $reference,
          amount: $amount,
          currency: $currency,
          status: $status,
          message: $message,
          notes: $notes
        }) {
          id
          transaction_id
          reference
          status
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      userId,
      transactionId,
      reference,
      amount,
      currency,
      status,
      message,
      notes,
    });
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    transactionId: string,
    status: string,
    callbackData: string
  ): Promise<void> {
    const mutation = `
      mutation UpdateAirtelMoneyPayment(
        $transactionId: String!,
        $status: String!,
        $callbackData: String!
      ) {
        update_airtel_money_payments(
          where: {transaction_id: {_eq: $transactionId}},
          _set: {
            status: $status,
            callback_data: $callbackData,
            updated_at: "now()"
          }
        ) {
          affected_rows
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      transactionId,
      status,
      callbackData,
    });
  }

  /**
   * Get payment by transaction ID
   */
  async getPaymentByTransactionId(transactionId: string): Promise<any> {
    const query = `
      query GetAirtelMoneyPayment($transactionId: String!) {
        airtel_money_payments(where: {transaction_id: {_eq: $transactionId}}) {
          id
          user_id
          transaction_id
          reference
          amount
          currency
          status
          message
          notes
          callback_data
          created_at
          updated_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      transactionId,
    });

    return result.airtel_money_payments[0] || null;
  }

  /**
   * Get payments by user ID
   */
  async getPaymentsByUserId(userId: string): Promise<any[]> {
    const query = `
      query GetAirtelMoneyPaymentsByUser($userId: uuid!) {
        airtel_money_payments(
          where: {user_id: {_eq: $userId}},
          order_by: {created_at: desc}
        ) {
          id
          transaction_id
          reference
          amount
          currency
          status
          message
          notes
          callback_data
          created_at
          updated_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
    });

    return result.airtel_money_payments || [];
  }
}
