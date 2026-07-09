import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { PersonaId } from '../users/persona.types';
import { resolveActivePersonaWithDefault } from '../users/persona.util';
import type { ForceRefundDto } from './admin-refunds.dto';
import type {
  ApproveFullRefundDto,
  ApprovePartialRefundDto,
  ApproveReplaceItemDto,
  CreateRefundRequestDto,
  RejectRefundDto,
} from './order-refunds.dto';
import { isOrderRefundRequestAllowed } from './order-refund-window.util';
import { OrderQueueService } from './order-queue.service';
import { RefundConfigService } from './refund-config.service';
import { RefundDestinationRouter } from './refund-destination.router';
import { RefundEventService } from './refund-event.service';
import { RefundPaymentService } from './refund-payment.service';
import { ReturnWorkflowService } from './return-workflow.service';
import type { RefundDestination, RefundOrderContext } from './refund.types';

const ELIGIBLE_FOR_CLIENT_REQUEST = ['complete', 'refund_rejected'];
const ELIGIBLE_FOR_LEGACY_REFUND = ['complete', 'delivered', 'failed'];
const SLA_HOURS = 48;

@Injectable()
export class OrderRefundsService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly accountsService: AccountsService,
    private readonly orderQueueService: OrderQueueService,
    private readonly refundConfig: RefundConfigService,
    private readonly destinationRouter: RefundDestinationRouter,
    private readonly refundPaymentService: RefundPaymentService,
    private readonly refundEventService: RefundEventService,
    private readonly returnWorkflowService: ReturnWorkflowService
  ) {}

  async createRefundRequest(orderId: string, dto: CreateRefundRequestDto) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(user, 'client', 'Only clients can request a refund');
    const order = await this.fetchOrderContext(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.client.user_id !== user.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    this.assertClientRefundEligibility(order);
    await this.assertNoOpenRefundRequest(order.id);
    const destination = this.destinationRouter.resolve(order.payment_source);
    const insertResult = await this.insertRefundRequest(order, dto, destination);
    await this.transitionOrderStatus(
      order.id,
      order.current_status,
      'refund_requested',
      user.id,
      'Refund requested by client'
    );
    await this.refundEventService.appendEvent({
      refundRequestId: insertResult.id,
      eventType: 'requested',
      actorType: 'client',
      actorUserId: user.id,
      payload: { reason: dto.reason, destination },
    });
    const businessAddress = await this.fetchBusinessRegisteredAddress(order.business_id);
    return {
      success: true,
      refundRequest: insertResult,
      order: { id: order.id, current_status: 'refund_requested' },
      businessAddress,
      itemSubtotal: Number(order.subtotal),
      deliveryFeeTotal: this.deliveryFeeTotal(order),
      currency: order.currency,
      destination,
      message: 'Refund request submitted',
    };
  }

  async listRefundRequestsForBusiness(status = 'pending') {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(user, 'business', 'Only business users can list refund requests');
    const businessId = user.business?.id;
    if (!businessId) {
      throw new HttpException('Business not found', HttpStatus.BAD_REQUEST);
    }
    const rows = await this.queryBusinessRefundRequests(businessId, status);
    return { success: true, refundRequests: rows, count: rows.length };
  }

  async getRefundRequestByOrderId(orderId: string) {
    const user = await this.hasuraUserService.getUser();
    const order = await this.fetchOrderContext(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    this.assertCanViewRefund(order, user);
    const refundRequest = await this.fetchLatestRefundRequest(orderId);
    const timeline = refundRequest
      ? await this.refundEventService.listEvents(refundRequest.id as string)
      : [];
    const payments = refundRequest
      ? await this.fetchPaymentsForRequest(refundRequest.id as string)
      : [];
    const evidence = refundRequest
      ? await this.fetchEvidence(refundRequest.id as string)
      : [];
    const destination = this.destinationRouter.resolve(order.payment_source);
    return {
      success: true,
      order,
      refundRequest,
      timeline,
      payments,
      evidence,
      destination,
      paymentSource: order.payment_source,
    };
  }

  async approveFullRefund(orderId: string, dto: ApproveFullRefundDto) {
    this.assertInspectionAcknowledged(dto.inspectionAcknowledged);
    const { user, order, reqRow } = await this.loadBusinessPendingCase(orderId);
    const itemAmt = Number(order.subtotal);
    let totalAmt = itemAmt;
    if (dto.refundDeliveryFee) {
      totalAmt += this.deliveryFeeTotal(order);
    }
    await this.transitionOrderStatus(
      order.id,
      order.current_status,
      'refund_approved_full',
      user.id,
      'Full refund approved by business',
      dto.businessNote
    );
    await this.patchRefundRequest(reqRow.id, {
      approved_amount: totalAmt,
      refund_item_amount: itemAmt,
      refund_delivery_fee: dto.refundDeliveryFee ?? false,
      business_note: dto.businessNote ?? null,
      inspection_acknowledged_at: new Date().toISOString(),
      resolved_by_user_id: user.id,
      resolution_type: 'approved_full',
    });
    const payResult = await this.executeRefundPayments(order, reqRow.id, {
      itemAmount: itemAmt,
      deliveryFee: dto.refundDeliveryFee ? this.deliveryFeeTotal(order) : 0,
      refundType: 'post_delivery_full',
    });
    await this.finalizeApprovalCase(reqRow.id, order, user.id, payResult);
    return { success: true, message: payResult.message, payment: payResult };
  }

  async approvePartialRefund(orderId: string, dto: ApprovePartialRefundDto) {
    this.assertInspectionAcknowledged(dto.inspectionAcknowledged);
    const { user, order, reqRow } = await this.loadBusinessPendingCase(orderId);
    const subtotal = Number(order.subtotal);
    this.assertPartialAmount(dto.amount, subtotal);
    await this.transitionOrderStatus(
      order.id,
      order.current_status,
      'refund_approved_partial',
      user.id,
      'Partial refund approved by business',
      dto.businessNote
    );
    await this.patchRefundRequest(reqRow.id, {
      approved_amount: dto.amount,
      refund_item_amount: dto.amount,
      business_note: dto.businessNote ?? null,
      inspection_acknowledged_at: new Date().toISOString(),
      resolved_by_user_id: user.id,
      resolution_type: 'approved_partial',
    });
    const payResult = await this.executeRefundPayments(order, reqRow.id, {
      itemAmount: dto.amount,
      deliveryFee: 0,
      refundType: 'post_delivery_partial',
    });
    await this.finalizeApprovalCase(reqRow.id, order, user.id, payResult);
    return { success: true, message: payResult.message, payment: payResult };
  }

  async approveReplaceItem(orderId: string, dto: ApproveReplaceItemDto) {
    this.assertInspectionAcknowledged(dto.inspectionAcknowledged);
    const { user, order, reqRow } = await this.loadBusinessPendingCase(orderId);
    await this.transitionOrderStatus(
      order.id,
      order.current_status,
      'refund_approved_replace',
      user.id,
      'Item replacement with free delivery agreed by business',
      dto.businessNote
    );
    await this.finalizeRefundRequestRow(reqRow.id, {
      business_note: dto.businessNote ?? null,
      inspection_acknowledged_at: new Date().toISOString(),
      refundRequestStatus: 'approved_replace_item',
      resolution_type: 'replacement',
      resolved_by_user_id: user.id,
    });
    await this.refundEventService.appendEvent({
      refundRequestId: reqRow.id,
      eventType: 'replacement_offered',
      actorType: 'business',
      actorUserId: user.id,
    });
    return { success: true, message: 'Replacement with free delivery confirmed' };
  }

  async rejectRefundRequest(orderId: string, dto: RejectRefundDto) {
    const { user, order, reqRow } = await this.loadBusinessPendingCase(orderId);
    await this.patchRefundRequest(reqRow.id, {
      status: 'rejected',
      rejection_reason: dto.rejectionReason,
      resolved_at: new Date().toISOString(),
      resolution_type: 'rejected',
      resolved_by_user_id: user.id,
    });
    await this.transitionOrderStatus(
      order.id,
      order.current_status,
      'refund_rejected',
      user.id,
      `Refund rejected: ${dto.rejectionReason}`
    );
    await this.refundEventService.appendEvent({
      refundRequestId: reqRow.id,
      eventType: 'rejected',
      actorType: 'business',
      actorUserId: user.id,
      payload: { reason: dto.rejectionReason },
    });
    return { success: true, message: 'Refund request rejected' };
  }

  async requestReturn(orderId: string, instructions?: string) {
    const reqRow = await this.getLatestRequestForOrder(orderId);
    await this.returnWorkflowService.requestReturn(reqRow.id, instructions);
    return { success: true, message: 'Return requested' };
  }

  async requestInfo(orderId: string, message: string) {
    const { user, reqRow } = await this.loadBusinessPendingCase(orderId);
    await this.patchRefundRequest(reqRow.id, { info_request_message: message });
    await this.refundEventService.appendEvent({
      refundRequestId: reqRow.id,
      eventType: 'info_requested',
      actorType: 'business',
      actorUserId: user.id,
      payload: { message },
    });
    return { success: true, message: 'Information requested from client' };
  }

  async addEvidence(orderId: string, fileUrl: string, mimeType?: string) {
    const user = await this.hasuraUserService.getUser();
    const order = await this.fetchOrderContext(orderId);
    if (!order || order.client.user_id !== user.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const reqRow = await this.getLatestRequestForOrder(orderId);
    const mutation = `
      mutation AddEvidence($object: order_refund_evidence_insert_input!) {
        insert_order_refund_evidence_one(object: $object) { id file_url created_at }
      }
    `;
    const res = await this.hasuraSystemService.executeMutation(mutation, {
      object: {
        refund_request_id: reqRow.id,
        file_url: fileUrl,
        mime_type: mimeType ?? null,
        uploaded_by_user_id: user.id,
      },
    });
    await this.refundEventService.appendEvent({
      refundRequestId: reqRow.id,
      eventType: 'evidence_uploaded',
      actorType: 'client',
      actorUserId: user.id,
    });
    return { success: true, evidence: res.insert_order_refund_evidence_one };
  }

  async respondToInfoRequest(orderId: string, message: string) {
    const user = await this.hasuraUserService.getUser();
    const order = await this.fetchOrderContext(orderId);
    if (!order || order.client.user_id !== user.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const reqRow = await this.getLatestRequestForOrder(orderId);
    await this.refundEventService.appendEvent({
      refundRequestId: reqRow.id,
      eventType: 'info_response',
      actorType: 'client',
      actorUserId: user.id,
      payload: { message },
    });
    return { success: true, message: 'Response recorded' };
  }

  async confirmReturnShipped(orderId: string) {
    const reqRow = await this.getLatestRequestForOrder(orderId);
    await this.returnWorkflowService.confirmReturnShipped(reqRow.id);
    return { success: true, message: 'Return marked in transit' };
  }

  async markReturnReceived(orderId: string, notes?: string) {
    const reqRow = await this.getLatestRequestForOrder(orderId);
    await this.returnWorkflowService.markReceived(reqRow.id, notes);
    return { success: true, message: 'Return marked received' };
  }

  async adminForceRefund(dto: ForceRefundDto) {
    const order = await this.fetchOrderContext(dto.orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (!ELIGIBLE_FOR_LEGACY_REFUND.includes(order.current_status)) {
      throw new HttpException(
        `Cannot refund order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    }
    const user = await this.hasuraUserService.getUser();
    const itemAmt = dto.amount ?? Number(order.subtotal);
    const destination = this.destinationRouter.resolve(
      order.payment_source,
      dto.forceDestination
    );
    const reqRow = await this.insertForceRefundCase(order, user.id, destination, itemAmt);
    const payResult = await this.refundPaymentService.processPayment({
      refundRequestId: reqRow.id,
      order,
      amount: itemAmt,
      refundType: 'force_admin',
      forceDestination: dto.forceDestination,
    });
    if (dto.refundDeliveryFee) {
      const delivery = this.deliveryFeeTotal(order);
      if (delivery > 0) {
        await this.refundPaymentService.processPayment({
          refundRequestId: reqRow.id,
          order,
          amount: delivery,
          refundType: 'force_admin',
          idempotencySuffix: 'delivery',
          forceDestination: dto.forceDestination,
        });
      }
    }
    if (payResult.success && !payResult.async) {
      await this.finalizeRefundRequestRow(reqRow.id, {
        inspection_acknowledged_at: new Date().toISOString(),
        resolution_type: 'force_admin',
        resolved_by_user_id: user.id,
      });
      await this.transitionOrderStatus(
        order.id,
        order.current_status,
        'refunded',
        user.id,
        'Admin force refund completed'
      );
    }
    return { success: payResult.success, payment: payResult, refundRequestId: reqRow.id };
  }

  async listAllRefundRequestsForAdmin(status?: string) {
    const query = `
      query AdminRefunds($where: order_refund_requests_bool_exp) {
        order_refund_requests(
          where: $where
          order_by: { created_at: desc }
          limit: 100
        ) {
          id status reason destination payment_source_snapshot approved_amount
          currency created_at resolved_at
          order { id order_number current_status payment_source }
        }
      }
    `;
    const where = status ? { status: { _eq: status } } : {};
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_requests: unknown[];
    }>(query, { where });
    return { success: true, refundRequests: res.order_refund_requests };
  }

  async getRefundMetrics() {
    const query = `
      query RefundMetrics {
        total: order_refund_requests_aggregate { aggregate { count } }
        pending: order_refund_requests_aggregate(where: { status: { _eq: pending } }) {
          aggregate { count }
        }
        completed: order_refund_requests_aggregate(where: { status: { _eq: completed } }) {
          aggregate { count }
        }
        rejected: order_refund_requests_aggregate(where: { status: { _eq: rejected } }) {
          aggregate { count }
        }
        failedPayments: order_refund_payments_aggregate(where: { status: { _eq: failed } }) {
          aggregate { count }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      total: { aggregate: { count: number } };
      pending: { aggregate: { count: number } };
      completed: { aggregate: { count: number } };
      rejected: { aggregate: { count: number } };
      failedPayments: { aggregate: { count: number } };
    }>(query);
    const total = res.total.aggregate.count || 1;
    return {
      success: true,
      metrics: {
        totalRequests: res.total.aggregate.count,
        pending: res.pending.aggregate.count,
        completed: res.completed.aggregate.count,
        rejected: res.rejected.aggregate.count,
        failedPayments: res.failedPayments.aggregate.count,
        approvalRate: (res.completed.aggregate.count / total) * 100,
        rejectionRate: (res.rejected.aggregate.count / total) * 100,
      },
    };
  }

  async listFailedPayments() {
    const query = `
      query FailedPayments {
        order_refund_payments(
          where: { status: { _eq: failed } }
          order_by: { updated_at: desc }
          limit: 50
        ) {
          id amount currency failure_reason attempt updated_at destination
          refund_request { id order { id order_number } }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query);
    return { success: true, payments: res.order_refund_payments };
  }

  /** @deprecated Use refund request workflow or admin force refund */
  async legacyDirectFullRefund(_orderId: string, _notes?: string) {
    throw new HttpException(
      'Direct refunds via this endpoint are disabled. Clients should submit a refund request; admins should use POST /admin/refunds/force.',
      HttpStatus.GONE
    );
  }

  private async executeRefundPayments(
    order: RefundOrderContext,
    refundRequestId: string,
    input: {
      itemAmount: number;
      deliveryFee: number;
      refundType: 'post_delivery_full' | 'post_delivery_partial';
    }
  ) {
    if (!this.refundConfig.isV2Enabled()) {
      await this.legacyWalletCredit(order, input.itemAmount);
      if (input.deliveryFee > 0) {
        await this.legacyWalletCredit(order, input.deliveryFee, 'delivery fee');
      }
      return {
        success: true,
        async: false,
        message: 'Refund processed to wallet (legacy mode)',
      };
    }
    const itemResult = await this.refundPaymentService.processPayment({
      refundRequestId,
      order,
      amount: input.itemAmount,
      refundType: input.refundType,
    });
    if (!itemResult.success) {
      return itemResult;
    }
    if (input.deliveryFee > 0) {
      const deliveryResult = await this.refundPaymentService.processPayment({
        refundRequestId,
        order,
        amount: input.deliveryFee,
        refundType: input.refundType,
        idempotencySuffix: 'delivery_fee',
      });
      if (!deliveryResult.success) {
        return deliveryResult;
      }
      if (deliveryResult.async || itemResult.async) {
        return { ...itemResult, async: true, message: 'Refund processing' };
      }
    }
    return itemResult;
  }

  private async finalizeApprovalCase(
    refundRequestId: string,
    order: RefundOrderContext,
    userId: string,
    payResult: { success: boolean; async?: boolean; message: string }
  ) {
    await this.refundEventService.appendEvent({
      refundRequestId,
      eventType: payResult.async ? 'payment_processing' : 'payment_completed',
      actorType: 'business',
      actorUserId: userId,
      payload: { message: payResult.message },
    });
    if (!payResult.success) {
      await this.transitionOrderStatus(
        order.id,
        order.current_status,
        'refund_failed',
        userId,
        payResult.message
      );
      return;
    }
    if (payResult.async) {
      return;
    }
    await this.finalizeRefundRequestRow(refundRequestId, {
      inspection_acknowledged_at: new Date().toISOString(),
    });
    await this.transitionOrderStatus(
      order.id,
      order.current_status,
      'refunded',
      userId,
      'Refund completed'
    );
  }

  private async legacyWalletCredit(
    order: RefundOrderContext,
    amount: number,
    suffix = ''
  ) {
    if (amount <= 0) {
      return;
    }
    const account = await this.hasuraSystemService.getAccount(
      order.client.user_id,
      order.currency
    );
    if (!account) {
      throw new HttpException('Client account not found', HttpStatus.NOT_FOUND);
    }
    const memo = suffix
      ? `Refund (${suffix}) for order ${order.order_number}`
      : `Refund for order ${order.order_number}`;
    const result = await this.accountsService.registerTransaction({
      accountId: account.id,
      amount,
      transactionType: 'refund',
      memo,
      referenceId: order.id,
    });
    if (!result.success) {
      throw new HttpException(result.error || 'Failed to register refund', HttpStatus.BAD_REQUEST);
    }
  }

  private deliveryFeeTotal(order: RefundOrderContext): number {
    return Number(order.base_delivery_fee) + Number(order.per_km_delivery_fee);
  }

  private async insertRefundRequest(
    order: RefundOrderContext,
    dto: CreateRefundRequestDto,
    destination: RefundDestination
  ) {
    const priorCount = await this.countPriorRequests(order.id);
    if (priorCount >= 2) {
      throw new HttpException(
        'Refund re-request limit reached for this order',
        HttpStatus.BAD_REQUEST
      );
    }
    const slaDue = new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000).toISOString();
    const mutation = `
      mutation InsertRefundRequest($object: order_refund_requests_insert_input!) {
        insert_order_refund_requests_one(object: $object) {
          id status created_at destination payment_source_snapshot
        }
      }
    `;
    const res = await this.hasuraSystemService.executeMutation(mutation, {
      object: {
        order_id: order.id,
        client_id: order.client_id,
        business_id: order.business_id,
        reason: dto.reason,
        client_notes: dto.clientNotes ?? null,
        status: 'pending',
        requested_amount: Number(order.subtotal),
        currency: order.currency,
        payment_source_snapshot: order.payment_source,
        destination,
        sla_due_at: slaDue,
        reopen_count: priorCount,
      },
    });
    return res.insert_order_refund_requests_one;
  }

  private async insertForceRefundCase(
    order: RefundOrderContext,
    adminUserId: string,
    destination: RefundDestination,
    amount: number
  ) {
    const mutation = `
      mutation InsertForce($object: order_refund_requests_insert_input!) {
        insert_order_refund_requests_one(object: $object) { id }
      }
    `;
    const res = await this.hasuraSystemService.executeMutation(mutation, {
      object: {
        order_id: order.id,
        client_id: order.client_id,
        business_id: order.business_id,
        reason: 'other',
        status: 'pending',
        resolution_type: 'force_admin',
        requested_amount: amount,
        approved_amount: amount,
        currency: order.currency,
        payment_source_snapshot: order.payment_source,
        destination,
        resolved_by_user_id: adminUserId,
      },
    });
    return res.insert_order_refund_requests_one;
  }

  private async loadBusinessPendingCase(orderId: string) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(user, 'business', 'Only business users can approve refunds');
    const order = await this.fetchOrderContext(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.business.user_id !== user.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const reqRow = await this.getPendingRefundRequestRow(order.id);
    if (!reqRow) {
      throw new HttpException('No pending refund request for this order', HttpStatus.BAD_REQUEST);
    }
    if (order.current_status !== 'refund_requested') {
      throw new HttpException('Order is not awaiting refund resolution', HttpStatus.BAD_REQUEST);
    }
    return { user, order, reqRow };
  }

  private async getLatestRequestForOrder(orderId: string) {
    const row = await this.fetchLatestRefundRequest(orderId);
    if (!row) {
      throw new HttpException('No refund request for this order', HttpStatus.NOT_FOUND);
    }
    return row as { id: string };
  }

  private async fetchLatestRefundRequest(orderId: string) {
    const q = `
      query OneRefundRequest($orderId: uuid!) {
        order_refund_requests(
          where: { order_id: { _eq: $orderId } }
          order_by: { created_at: desc }
          limit: 1
        ) {
          id status reason client_notes business_note rejection_reason
          refund_item_amount refund_delivery_fee inspection_acknowledged_at
          created_at resolved_at destination payment_source_snapshot approved_amount
          currency return_status return_required info_request_message reopen_count sla_due_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_requests: Record<string, unknown>[];
    }>(q, { orderId });
    return res.order_refund_requests[0] ?? null;
  }

  private async fetchPaymentsForRequest(refundRequestId: string) {
    const q = `
      query Payments($id: uuid!) {
        order_refund_payments(
          where: { refund_request_id: { _eq: $id } }
          order_by: { created_at: asc }
        ) {
          id destination amount currency status failure_reason attempt created_at updated_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(q, { id: refundRequestId });
    return res.order_refund_payments ?? [];
  }

  private async fetchEvidence(refundRequestId: string) {
    const q = `
      query Evidence($id: uuid!) {
        order_refund_evidence(
          where: { refund_request_id: { _eq: $id } }
          order_by: { created_at: asc }
        ) { id file_url mime_type created_at }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(q, { id: refundRequestId });
    return res.order_refund_evidence ?? [];
  }

  private async queryBusinessRefundRequests(businessId: string, status: string) {
    const q = `
      query ListRefundRequests($businessId: uuid!, $status: refund_request_status!) {
        order_refund_requests(
          where: { business_id: { _eq: $businessId }, status: { _eq: $status } }
          order_by: { created_at: desc }
        ) {
          id status reason client_notes created_at destination payment_source_snapshot
          sla_due_at return_status approved_amount currency
          order {
            id order_number current_status subtotal total_amount
            base_delivery_fee per_km_delivery_fee currency completed_at payment_source
            order_items { id item_name quantity unit_price total_price }
            delivery_address {
              address_line_1 address_line_2 city state postal_code country
            }
            client { user { first_name last_name email } }
          }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(q, { businessId, status });
    return res.order_refund_requests ?? [];
  }

  private async fetchOrderContext(orderId: string): Promise<RefundOrderContext | null> {
    const query = `
      query OrderRefundCtx($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id order_number current_status subtotal base_delivery_fee per_km_delivery_fee
          currency completed_at client_id business_id business_location_id
          payment_source payment_status
          client { user_id }
          business { user_id }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: RefundOrderContext | null;
    }>(query, { orderId });
    return res.orders_by_pk;
  }

  private async fetchBusinessRegisteredAddress(businessId: string) {
    const q = `
      query Ba($bid: uuid!) {
        business_addresses(
          where: { business_id: { _eq: $bid }, address: { status: { _eq: active } } }
          limit: 1
        ) {
          id
          address {
            id address_line_1 address_line_2 city state postal_code country instructions
          }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      business_addresses: { id: string; address: Record<string, unknown> }[];
    }>(q, { bid: businessId });
    return res.business_addresses[0] ?? null;
  }

  private assertClientRefundEligibility(order: RefundOrderContext) {
    if (!ELIGIBLE_FOR_CLIENT_REQUEST.includes(order.current_status)) {
      throw new HttpException(
        'Refunds can only be requested for delivered (complete) orders or after a rejection',
        HttpStatus.BAD_REQUEST
      );
    }
    if (!isOrderRefundRequestAllowed(order.completed_at)) {
      throw new HttpException(
        'Return window has expired; refunds are only available within 3 days after order completion',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async assertNoOpenRefundRequest(orderId: string) {
    const q = `
      query Open($oid: uuid!) {
        order_refund_requests(
          where: { order_id: { _eq: $oid }, status: { _eq: pending } }
          limit: 1
        ) { id }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_requests: { id: string }[];
    }>(q, { oid: orderId });
    if (res.order_refund_requests.length > 0) {
      throw new HttpException(
        'A refund request is already pending for this order',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async countPriorRequests(orderId: string): Promise<number> {
    const q = `
      query Prior($oid: uuid!) {
        order_refund_requests_aggregate(where: { order_id: { _eq: $oid } }) {
          aggregate { count }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_requests_aggregate: { aggregate: { count: number } };
    }>(q, { oid: orderId });
    return res.order_refund_requests_aggregate.aggregate.count ?? 0;
  }

  private async getPendingRefundRequestRow(orderId: string): Promise<{ id: string } | null> {
    const q = `
      query P($oid: uuid!) {
        order_refund_requests(
          where: { order_id: { _eq: $oid }, status: { _eq: pending } }
          limit: 1
        ) { id }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_requests: { id: string }[];
    }>(q, { oid: orderId });
    return res.order_refund_requests[0] ?? null;
  }

  private async transitionOrderStatus(
    orderId: string,
    previousStatus: string,
    status: string,
    actorUserId: string,
    notes: string,
    additionalNotes?: string
  ) {
    await this.setOrderStatus(orderId, status);
    await this.insertStatusHistory(orderId, status, notes, 'system', actorUserId, additionalNotes);
    await this.orderQueueService.sendOrderStatusUpdatedMessage(
      orderId,
      previousStatus,
      status,
      actorUserId
    );
  }

  private async setOrderStatus(orderId: string, status: string) {
    const m = `
      mutation SetOrderStatus($id: uuid!, $status: order_status!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: { current_status: $status, updated_at: "now()" }
        ) { id current_status }
      }
    `;
    await this.hasuraSystemService.executeMutation(m, { id: orderId, status });
  }

  private async patchRefundRequest(id: string, fields: Record<string, unknown>) {
    const mutation = `
      mutation Patch($id: uuid!, $set: order_refund_requests_set_input!) {
        update_order_refund_requests_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, { id, set: fields });
  }

  private async finalizeRefundRequestRow(
    id: string,
    fields: {
      refund_item_amount?: number;
      refund_delivery_fee?: boolean;
      business_note?: string | null;
      inspection_acknowledged_at: string;
      refundRequestStatus?: 'completed' | 'approved_replace_item';
      resolution_type?: string;
      resolved_by_user_id?: string;
    }
  ) {
    const rowStatus = fields.refundRequestStatus ?? 'completed';
    await this.patchRefundRequest(id, {
      status: rowStatus,
      resolved_at: new Date().toISOString(),
      refund_item_amount: fields.refund_item_amount ?? null,
      refund_delivery_fee: fields.refund_delivery_fee ?? null,
      business_note: fields.business_note ?? null,
      inspection_acknowledged_at: fields.inspection_acknowledged_at,
      resolution_type: fields.resolution_type ?? null,
      resolved_by_user_id: fields.resolved_by_user_id ?? null,
    });
  }

  private async insertStatusHistory(
    orderId: string,
    status: string,
    notes: string,
    changedByType: string,
    changedByUserId: string,
    additionalNotes?: string
  ) {
    const finalNotes = additionalNotes ? `${notes}. ${additionalNotes}` : notes;
    const mutation = `
      mutation CreateStatusHistory($orderId: uuid!, $status: order_status!, $notes: String!, $changedByType: String!, $changedByUserId: uuid!) {
        insert_order_status_history(objects: [{
          order_id: $orderId, status: $status, notes: $notes,
          changed_by_type: $changedByType, changed_by_user_id: $changedByUserId
        }]) { affected_rows }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      status,
      notes: finalNotes,
      changedByType,
      changedByUserId,
    });
  }

  private assertCanViewRefund(order: RefundOrderContext, user: { id: string; business?: { id: string; user_id?: string } }) {
    const isClient = order.client.user_id === user.id;
    const active = resolveActivePersonaWithDefault(
      user,
      this.hasuraUserService.getActivePersonaHeader()
    );
    const isBusiness = active === 'business' && order.business.user_id === user.id;
    if (!isClient && !isBusiness) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private assertInspectionAcknowledged(ack: boolean) {
    if (!ack) {
      throw new HttpException(
        'Inspection must be acknowledged before approving a refund',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private assertPartialAmount(amount: number, subtotal: number) {
    if (amount >= subtotal) {
      throw new HttpException(
        'Partial refund must be less than item subtotal; use full refund instead',
        HttpStatus.BAD_REQUEST
      );
    }
    if (amount <= 0) {
      throw new HttpException('Amount must be positive', HttpStatus.BAD_REQUEST);
    }
  }

  private requireActivePersona(user: any, persona: PersonaId, message: string) {
    const active = resolveActivePersonaWithDefault(
      user,
      this.hasuraUserService.getActivePersonaHeader()
    );
    if (active !== persona) {
      throw new HttpException(message, HttpStatus.FORBIDDEN);
    }
  }
}
