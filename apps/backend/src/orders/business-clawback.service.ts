import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { AccountsService } from '../accounts/accounts.service';
import type { RefundOrderContext } from './refund.types';

@Injectable()
export class BusinessClawbackService {
  private readonly logger = new Logger(BusinessClawbackService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly accountsService: AccountsService
  ) {}

  async clawbackItemSubtotal(
    order: RefundOrderContext,
    amount: number,
    referenceId: string
  ): Promise<void> {
    if (amount <= 0) {
      return;
    }
    const businessUserId = order.business.user_id;
    const locationId = order.business_location_id ?? undefined;
    const account = await this.hasuraSystemService.getAccount(
      businessUserId,
      order.currency,
      locationId
    );
    if (!account) {
      this.logger.warn(
        `Clawback skipped: no business account for order ${order.order_number}`
      );
      return;
    }
    const result = await this.accountsService.registerTransaction({
      accountId: account.id,
      amount,
      transactionType: 'withdrawal',
      memo: `Refund clawback for order ${order.order_number}`,
      referenceId,
    });
    if (!result.success) {
      this.logger.warn(
        `Clawback debt for order ${order.order_number}: ${result.error}`
      );
      await this.recordClawbackDebt(order, amount, result.error);
    }
  }

  private async recordClawbackDebt(
    order: RefundOrderContext,
    amount: number,
    error?: string
  ): Promise<void> {
    const mutation = `
      mutation InsertClawbackNote($object: order_refund_events_insert_input!) {
        insert_order_refund_events_one(object: $object) { id }
      }
    `;
    const reqQuery = `
      query LatestReq($oid: uuid!) {
        order_refund_requests(
          where: { order_id: { _eq: $oid } }
          order_by: { created_at: desc }
          limit: 1
        ) { id }
      }
    `;
    const reqRes = await this.hasuraSystemService.executeQuery<{
      order_refund_requests: { id: string }[];
    }>(reqQuery, { oid: order.id });
    const refundRequestId = reqRes.order_refund_requests[0]?.id;
    if (!refundRequestId) {
      return;
    }
    await this.hasuraSystemService.executeMutation(mutation, {
      object: {
        refund_request_id: refundRequestId,
        event_type: 'clawback_debt',
        actor_type: 'system',
        payload: { amount, currency: order.currency, error: error ?? null },
      },
    });
  }
}
