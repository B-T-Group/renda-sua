import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { StripeRefundService } from '../stripe-payments/stripe-refund.service';
import { BusinessClawbackService } from './business-clawback.service';
import { RefundDestinationRouter } from './refund-destination.router';
import type {
  ProcessRefundPaymentParams,
  RefundDestination,
  RefundPaymentResult,
  RefundPaymentStatus,
} from './refund.types';
import { WalletRefundExecutor } from './wallet-refund.executor';

@Injectable()
export class RefundPaymentService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly destinationRouter: RefundDestinationRouter,
    private readonly walletExecutor: WalletRefundExecutor,
    private readonly stripeRefundService: StripeRefundService,
    private readonly clawbackService: BusinessClawbackService
  ) {}

  async processPayment(
    params: ProcessRefundPaymentParams
  ): Promise<RefundPaymentResult> {
    const destination = this.destinationRouter.resolve(
      params.order.payment_source,
      params.forceDestination
    );
    const attempt = await this.nextAttemptNumber(params.refundRequestId);
    const paymentId = await this.createPaymentRow({
      refundRequestId: params.refundRequestId,
      orderId: params.order.id,
      destination,
      amount: params.amount,
      currency: params.order.currency,
      attempt,
      idempotencyKey: this.buildIdempotencyKey(
        params.refundRequestId,
        attempt,
        params.idempotencySuffix
      ),
    });

    if (destination === 'stripe') {
      return this.processStripePayment(params, paymentId, attempt);
    }
    if (destination === 'wallet') {
      const result = await this.walletExecutor.execute({
        order: params.order,
        amount: params.amount,
        refundRequestId: params.refundRequestId,
        paymentId,
      });
      await this.clawbackService.clawbackItemSubtotal(params.order, params.amount);
      await this.updateOrderPaymentStatus(params.order.id, params.amount);
      return result;
    }
    throw new HttpException('Manual refund destination not supported', HttpStatus.BAD_REQUEST);
  }

  async retryPayment(paymentId: string): Promise<RefundPaymentResult> {
    const row = await this.getPaymentById(paymentId);
    if (!row || row.status !== 'failed') {
      throw new HttpException('Payment not retryable', HttpStatus.BAD_REQUEST);
    }
    const order = await this.fetchOrder(row.order_id);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    return this.processPayment({
      refundRequestId: row.refund_request_id,
      order,
      amount: Number(row.amount),
      refundType: 'post_delivery_partial',
      idempotencySuffix: `retry_${paymentId}`,
    });
  }

  async completeStripePayment(
    stripeRefundDbId: string,
    succeeded: boolean,
    failureReason?: string
  ): Promise<void> {
    const payment = await this.findPaymentByStripeRefundId(stripeRefundDbId);
    if (!payment) {
      return;
    }
    const status: RefundPaymentStatus = succeeded ? 'succeeded' : 'failed';
    await this.updatePayment(payment.id, {
      status,
      failure_reason: failureReason ?? null,
    });
    if (!succeeded) {
      await this.setOrderRefundFailed(payment.order_id);
      return;
    }
    const order = await this.fetchOrder(payment.order_id);
    if (order) {
      await this.clawbackService.clawbackItemSubtotal(order, Number(payment.amount));
      await this.maybeFinalizeIfAllPaymentsComplete(
        payment.order_id,
        payment.refund_request_id
      );
    }
  }

  private async processStripePayment(
    params: ProcessRefundPaymentParams,
    paymentId: string,
    attempt: number
  ): Promise<RefundPaymentResult> {
    await this.updatePayment(paymentId, { status: 'processing' });
    await this.setOrderStatus(params.order.id, 'refund_processing');
    const idempotencyKey = this.buildIdempotencyKey(
      params.refundRequestId,
      attempt,
      params.idempotencySuffix
    );
    const stripeResult = await this.stripeRefundService.initiatePostDeliveryRefund({
      orderId: params.order.id,
      orderNumber: params.order.order_number,
      amount: params.amount,
      refundRequestId: params.refundRequestId,
      refundPaymentId: paymentId,
      refundType:
        params.refundType === 'cancellation'
          ? 'post_delivery_full'
          : params.refundType,
      idempotencyKey,
    });
    if (!stripeResult.success) {
      await this.updatePayment(paymentId, {
        status: 'failed',
        failure_reason: stripeResult.message,
      });
      await this.setOrderRefundFailed(params.order.id);
      return {
        success: false,
        paymentId,
        destination: 'stripe',
        status: 'failed',
        async: true,
        message: stripeResult.message,
      };
    }
    if (stripeResult.stripeRefundDbId) {
      await this.updatePayment(paymentId, {
        stripe_refund_id: stripeResult.stripeRefundDbId,
        provider_ref: stripeResult.refundId ?? null,
      });
    }
    if (stripeResult.immediateSuccess) {
      await this.updatePayment(paymentId, { status: 'succeeded' });
      await this.clawbackService.clawbackItemSubtotal(params.order, params.amount);
      await this.maybeFinalizeIfAllPaymentsComplete(
        params.order.id,
        params.refundRequestId
      );
      return {
        success: true,
        paymentId,
        destination: 'stripe',
        status: 'succeeded',
        async: false,
        message: stripeResult.message,
        stripeRefundId: stripeResult.refundId,
      };
    }
    return {
      success: true,
      paymentId,
      destination: 'stripe',
      status: 'processing',
      async: true,
      message: stripeResult.message,
      stripeRefundId: stripeResult.refundId,
    };
  }

  private buildIdempotencyKey(
    refundRequestId: string,
    attempt: number,
    suffix?: string
  ): string {
    const base = `refund_payment_${refundRequestId}_${attempt}`;
    return suffix ? `${base}_${suffix}` : base;
  }

  private async createPaymentRow(input: {
    refundRequestId: string;
    orderId: string;
    destination: RefundDestination;
    amount: number;
    currency: string;
    attempt: number;
    idempotencyKey: string;
  }): Promise<string> {
    const mutation = `
      mutation InsertPayment($object: order_refund_payments_insert_input!) {
        insert_order_refund_payments_one(object: $object) { id }
      }
    `;
    const res = await this.hasuraSystemService.executeMutation<{
      insert_order_refund_payments_one: { id: string };
    }>(mutation, {
      object: {
        refund_request_id: input.refundRequestId,
        order_id: input.orderId,
        destination: input.destination,
        amount: input.amount,
        currency: input.currency,
        status: 'pending',
        attempt: input.attempt,
        idempotency_key: input.idempotencyKey,
      },
    });
    return res.insert_order_refund_payments_one.id;
  }

  private async nextAttemptNumber(refundRequestId: string): Promise<number> {
    const query = `
      query Attempts($id: uuid!) {
        order_refund_payments_aggregate(where: { refund_request_id: { _eq: $id } }) {
          aggregate { count }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_payments_aggregate: { aggregate: { count: number } };
    }>(query, { id: refundRequestId });
    return (res.order_refund_payments_aggregate.aggregate.count ?? 0) + 1;
  }

  private async getPaymentById(paymentId: string): Promise<{
    id: string;
    refund_request_id: string;
    order_id: string;
    amount: number;
    status: string;
  } | null> {
    const query = `
      query Payment($id: uuid!) {
        order_refund_payments_by_pk(id: $id) {
          id refund_request_id order_id amount status
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_payments_by_pk: {
        id: string;
        refund_request_id: string;
        order_id: string;
        amount: number;
        status: string;
      } | null;
    }>(query, { id: paymentId });
    return res.order_refund_payments_by_pk;
  }

  private async findPaymentByStripeRefundId(stripeRefundDbId: string): Promise<{
    id: string;
    order_id: string;
    refund_request_id: string;
    amount: number;
  } | null> {
    const query = `
      query ByStripe($sid: uuid!) {
        order_refund_payments(
          where: { stripe_refund_id: { _eq: $sid } }
          limit: 1
        ) { id order_id refund_request_id amount }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_payments: {
        id: string;
        order_id: string;
        refund_request_id: string;
        amount: number;
      }[];
    }>(query, { sid: stripeRefundDbId });
    return res.order_refund_payments[0] ?? null;
  }

  private async updatePayment(
    paymentId: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    const mutation = `
      mutation Upd($id: uuid!, $set: order_refund_payments_set_input!) {
        update_order_refund_payments_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      id: paymentId,
      set: fields,
    });
  }

  private async fetchOrder(orderId: string) {
    const query = `
      query Order($id: uuid!) {
        orders_by_pk(id: $id) {
          id order_number current_status subtotal base_delivery_fee per_km_delivery_fee
          currency completed_at client_id business_id business_location_id
          payment_source payment_status
          client { user_id }
          business { user_id }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: ProcessRefundPaymentParams['order'] | null;
    }>(query, { id: orderId });
    return res.orders_by_pk;
  }

  private async setOrderStatus(orderId: string, status: string): Promise<void> {
    const mutation = `
      mutation S($id: uuid!, $status: order_status!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: { current_status: $status }) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, { id: orderId, status });
  }

  private async setOrderRefundFailed(orderId: string): Promise<void> {
    await this.setOrderStatus(orderId, 'refund_failed');
  }

  private async maybeFinalizeIfAllPaymentsComplete(
    orderId: string,
    refundRequestId: string
  ): Promise<void> {
    const payments = await this.listPaymentsForRequest(refundRequestId);
    if (payments.length === 0) {
      return;
    }
    if (payments.some((p) => p.status === 'failed')) {
      return;
    }
    if (payments.some((p) => p.status === 'pending' || p.status === 'processing')) {
      return;
    }
    if (!payments.every((p) => p.status === 'succeeded')) {
      return;
    }
    await this.updateOrderPaymentStatusFromPayments(orderId, payments);
    await this.finalizeOrderRefunded(orderId, refundRequestId);
  }

  private async listPaymentsForRequest(refundRequestId: string): Promise<
    { amount: number; status: RefundPaymentStatus }[]
  > {
    const query = `
      query RefundPayments($id: uuid!) {
        order_refund_payments(where: { refund_request_id: { _eq: $id } }) {
          amount status
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_payments: { amount: number; status: RefundPaymentStatus }[];
    }>(query, { id: refundRequestId });
    return res.order_refund_payments ?? [];
  }

  private async finalizeOrderRefunded(
    orderId: string,
    refundRequestId: string
  ): Promise<void> {
    await this.setOrderStatus(orderId, 'refunded');
    const mutation = `
      mutation FinalizeCase($id: uuid!) {
        update_order_refund_requests_by_pk(
          pk_columns: { id: $id }
          _set: { status: completed, resolved_at: "now()" }
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, { id: refundRequestId });
  }

  private async updateOrderPaymentStatus(orderId: string, amount: number): Promise<void> {
    const order = await this.fetchOrder(orderId);
    if (!order) {
      return;
    }
    const subtotal = Number(order.subtotal);
    const paymentStatus =
      amount >= subtotal ? 'refunded' : 'partially_refunded';
    const mutation = `
      mutation PayStatus($id: uuid!, $ps: String!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: { payment_status: $ps }) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      id: orderId,
      ps: paymentStatus,
    });
  }

  private async updateOrderPaymentStatusFromPayments(
    orderId: string,
    payments: { amount: number; status: RefundPaymentStatus }[]
  ): Promise<void> {
    const totalRefunded = payments
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    await this.updateOrderPaymentStatus(orderId, totalRefunded);
  }
}
