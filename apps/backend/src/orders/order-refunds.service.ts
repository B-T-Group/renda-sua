import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { PersonaId } from '../users/persona.types';
import { resolveActivePersonaWithDefault } from '../users/persona.util';
import type {
  ApproveFullRefundDto,
  ApprovePartialRefundDto,
  ApproveReplaceItemDto,
  CreateRefundRequestDto,
  RejectRefundDto,
} from './order-refunds.dto';
import { isOrderRefundRequestAllowed } from './order-refund-window.util';
const ELIGIBLE_FOR_CLIENT_REQUEST = ['complete'];
const ELIGIBLE_FOR_LEGACY_REFUND = ['complete', 'delivered', 'failed'];

export interface OrderRefundContext {
  id: string;
  order_number: string;
  current_status: string;
  subtotal: number | string;
  base_delivery_fee: number | string;
  per_km_delivery_fee: number | string;
  currency: string;
  completed_at: string | null;
  client_id: string;
  business_id: string;
  client: { user_id: string };
  business: { user_id: string };
}

@Injectable()
export class OrderRefundsService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly accountsService: AccountsService
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
    await this.assertNoPendingRefundRequest(order.id);
    const insertMutation = `
      mutation InsertRefundRequest($object: order_refund_requests_insert_input!) {
        insert_order_refund_requests_one(object: $object) {
          id
          status
          created_at
        }
      }
    `;
    const insertResult = await this.hasuraSystemService.executeMutation<{
      insert_order_refund_requests_one: { id: string; status: string; created_at: string };
    }>(insertMutation, {
      object: {
        order_id: order.id,
        client_id: order.client_id,
        business_id: order.business_id,
        reason: dto.reason,
        client_notes: dto.clientNotes ?? null,
        status: 'pending',
      },
    });
    await this.setOrderStatus(order.id, 'refund_requested');
    await this.insertStatusHistory(
      order.id,
      'refund_requested',
      'Refund requested by client',
      'client',
      user.id
    );
    const businessAddress = await this.fetchBusinessRegisteredAddress(order.business_id);
    return {
      success: true,
      refundRequest: insertResult.insert_order_refund_requests_one,
      order: { id: order.id, current_status: 'refund_requested' },
      businessAddress,
      itemSubtotal: Number(order.subtotal),
      deliveryFeeTotal: this.deliveryFeeTotal(order),
      currency: order.currency,
      message: 'Refund request submitted',
    };
  }

  async listRefundRequestsForBusiness() {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only business users can list refund requests'
    );
    const businessId = user.business?.id;
    if (!businessId) {
      throw new HttpException('Business not found', HttpStatus.BAD_REQUEST);
    }
    const q = `
      query ListRefundRequests($businessId: uuid!) {
        order_refund_requests(
          where: { business_id: { _eq: $businessId }, status: { _eq: pending } }
          order_by: { created_at: desc }
        ) {
          id
          status
          reason
          client_notes
          created_at
          order {
            id
            order_number
            current_status
            subtotal
            total_amount
            base_delivery_fee
            per_km_delivery_fee
            currency
            completed_at
            order_items {
              id
              item_name
              quantity
              unit_price
              total_price
            }
            delivery_address {
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
            }
            client {
              user {
                first_name
                last_name
                email
              }
            }
          }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_requests: unknown[];
    }>(q, { businessId });
    return { success: true, refundRequests: res.order_refund_requests };
  }

  async getRefundRequestByOrderId(orderId: string) {
    const user = await this.hasuraUserService.getUser();
    const order = await this.fetchOrderContext(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    const isClient = order.client.user_id === user.id;
    const active = resolveActivePersonaWithDefault(
      user,
      this.hasuraUserService.getActivePersonaHeader()
    );
    const isBusiness = active === 'business' && order.business.user_id === user.id;
    if (!isClient && !isBusiness) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const q = `
      query OneRefundRequest($orderId: uuid!) {
        order_refund_requests(
          where: { order_id: { _eq: $orderId } }
          order_by: { created_at: desc }
          limit: 1
        ) {
          id
          status
          reason
          client_notes
          business_note
          rejection_reason
          refund_item_amount
          refund_delivery_fee
          inspection_acknowledged_at
          created_at
          resolved_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_requests: Record<string, unknown>[];
    }>(q, { orderId });
    return {
      success: true,
      order,
      refundRequest: res.order_refund_requests[0] ?? null,
    };
  }

  async approveFullRefund(orderId: string, dto: ApproveFullRefundDto) {
    if (!dto.inspectionAcknowledged) {
      throw new HttpException(
        'Inspection must be acknowledged before approving a refund',
        HttpStatus.BAD_REQUEST
      );
    }
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only business users can approve refunds'
    );
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
      throw new HttpException(
        'Order is not awaiting refund resolution',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.setOrderStatus(order.id, 'refund_approved_full');
    await this.insertStatusHistory(
      order.id,
      'refund_approved_full',
      'Full refund approved by business',
      'business',
      user.id,
      dto.businessNote
    );
    const itemAmt = Number(order.subtotal);
    await this.creditClientRefund(order, itemAmt);
    if (dto.refundDeliveryFee) {
      const d = this.deliveryFeeTotal(order);
      if (d > 0) {
        await this.creditClientRefund(order, d, 'delivery fee');
      }
    }
    await this.finalizeRefundRequestRow(reqRow.id, {
      refund_delivery_fee: dto.refundDeliveryFee ?? false,
      business_note: dto.businessNote ?? null,
      inspection_acknowledged_at: new Date().toISOString(),
    });
    await this.setOrderStatus(order.id, 'refunded');
    await this.insertStatusHistory(
      order.id,
      'refunded',
      'Refund completed (full)',
      'business',
      user.id
    );
    return { success: true, message: 'Full refund processed' };
  }

  async approvePartialRefund(orderId: string, dto: ApprovePartialRefundDto) {
    if (!dto.inspectionAcknowledged) {
      throw new HttpException(
        'Inspection must be acknowledged before approving a refund',
        HttpStatus.BAD_REQUEST
      );
    }
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only business users can approve refunds'
    );
    const order = await this.fetchOrderContext(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.business.user_id !== user.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const subtotal = Number(order.subtotal);
    if (dto.amount >= subtotal) {
      throw new HttpException(
        'Partial refund must be less than item subtotal; use full refund instead',
        HttpStatus.BAD_REQUEST
      );
    }
    if (dto.amount <= 0) {
      throw new HttpException('Amount must be positive', HttpStatus.BAD_REQUEST);
    }
    const reqRow = await this.getPendingRefundRequestRow(order.id);
    if (!reqRow) {
      throw new HttpException('No pending refund request for this order', HttpStatus.BAD_REQUEST);
    }
    if (order.current_status !== 'refund_requested') {
      throw new HttpException(
        'Order is not awaiting refund resolution',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.setOrderStatus(order.id, 'refund_approved_partial');
    await this.insertStatusHistory(
      order.id,
      'refund_approved_partial',
      'Partial refund approved by business',
      'business',
      user.id,
      dto.businessNote
    );
    await this.creditClientRefund(order, dto.amount);
    await this.finalizeRefundRequestRow(reqRow.id, {
      refund_item_amount: dto.amount,
      business_note: dto.businessNote ?? null,
      inspection_acknowledged_at: new Date().toISOString(),
    });
    await this.setOrderStatus(order.id, 'refunded');
    await this.insertStatusHistory(
      order.id,
      'refunded',
      'Refund completed (partial)',
      'business',
      user.id
    );
    return { success: true, message: 'Partial refund processed' };
  }

  async approveReplaceItem(orderId: string, dto: ApproveReplaceItemDto) {
    if (!dto.inspectionAcknowledged) {
      throw new HttpException(
        'Inspection must be acknowledged before approving a replacement',
        HttpStatus.BAD_REQUEST
      );
    }
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only business users can approve refunds'
    );
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
      throw new HttpException(
        'Order is not awaiting refund resolution',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.setOrderStatus(order.id, 'refund_approved_replace');
    await this.insertStatusHistory(
      order.id,
      'refund_approved_replace',
      'Item replacement with free delivery agreed by business',
      'business',
      user.id,
      dto.businessNote
    );
    await this.finalizeRefundRequestRow(reqRow.id, {
      business_note: dto.businessNote ?? null,
      inspection_acknowledged_at: new Date().toISOString(),
      refundRequestStatus: 'approved_replace_item',
    });
    return { success: true, message: 'Replacement with free delivery confirmed' };
  }

  async rejectRefundRequest(orderId: string, dto: RejectRefundDto) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only business users can reject refund requests'
    );
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
      throw new HttpException(
        'Order is not awaiting refund resolution',
        HttpStatus.BAD_REQUEST
      );
    }
    const updateMutation = `
      mutation UpdateReq(
        $id: uuid!
        $status: refund_request_status!
        $rejection_reason: String!
        $resolved_at: timestamptz!
      ) {
        update_order_refund_requests_by_pk(
          pk_columns: { id: $id }
          _set: {
            status: $status
            rejection_reason: $rejection_reason
            resolved_at: $resolved_at
            updated_at: "now()"
          }
        ) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(updateMutation, {
      id: reqRow.id,
      status: 'rejected',
      rejection_reason: dto.rejectionReason,
      resolved_at: new Date().toISOString(),
    });
    await this.setOrderStatus(order.id, 'refund_rejected');
    await this.insertStatusHistory(
      order.id,
      'refund_rejected',
      `Refund rejected: ${dto.rejectionReason}`,
      'business',
      user.id
    );
    return { success: true, message: 'Refund request rejected' };
  }

  /** Legacy business-only refund without client request (immediate full item refund). */
  async legacyDirectFullRefund(orderId: string, notes?: string) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only business users can refund orders'
    );
    const order = await this.fetchOrderContext(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.business.user_id !== user.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (!ELIGIBLE_FOR_LEGACY_REFUND.includes(order.current_status)) {
      throw new HttpException(
        `Cannot refund order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    }
    const itemAmt = Number(order.subtotal);
    if (itemAmt > 0) {
      await this.creditClientRefund(order, itemAmt);
    }
    await this.setOrderStatus(order.id, 'refunded');
    await this.insertStatusHistory(
      order.id,
      'refunded',
      'Order refunded by business (legacy)',
      'business',
      user.id,
      notes
    );
    return {
      success: true,
      message: 'Order refunded successfully',
      order: { id: order.id, current_status: 'refunded' as const },
    };
  }

  private deliveryFeeTotal(order: OrderRefundContext): number {
    return Number(order.base_delivery_fee) + Number(order.per_km_delivery_fee);
  }

  private async creditClientRefund(
    order: OrderRefundContext,
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
      throw new HttpException(
        result.error || 'Failed to register refund',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async finalizeRefundRequestRow(
    id: string,
    fields: {
      refund_item_amount?: number;
      refund_delivery_fee?: boolean;
      business_note?: string | null;
      inspection_acknowledged_at: string;
      refundRequestStatus?: 'completed' | 'approved_replace_item';
    }
  ) {
    const resolvedAt = new Date().toISOString();
    const rowStatus = fields.refundRequestStatus ?? 'completed';
    const mutation = `
      mutation FinalizeRefund($id: uuid!, $set: order_refund_requests_set_input!) {
        update_order_refund_requests_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      id,
      set: {
        status: rowStatus,
        resolved_at: resolvedAt,
        refund_item_amount: fields.refund_item_amount ?? null,
        refund_delivery_fee: fields.refund_delivery_fee ?? null,
        business_note: fields.business_note ?? null,
        inspection_acknowledged_at: fields.inspection_acknowledged_at,
      },
    });
  }

  private async fetchOrderContext(orderId: string): Promise<OrderRefundContext | null> {
    const query = `
      query OrderRefundCtx($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          subtotal
          base_delivery_fee
          per_km_delivery_fee
          currency
          completed_at
          client_id
          business_id
          client {
            user_id
          }
          business {
            user_id
          }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: OrderRefundContext | null;
    }>(query, { orderId });
    return res.orders_by_pk;
  }

  private async fetchBusinessRegisteredAddress(businessId: string) {
    const q = `
      query Ba($bid: uuid!) {
        business_addresses(where: { business_id: { _eq: $bid } }, limit: 1) {
          id
          address {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
            instructions
          }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      business_addresses: { id: string; address: Record<string, unknown> }[];
    }>(q, { bid: businessId });
    return res.business_addresses[0] ?? null;
  }

  private assertClientRefundEligibility(order: OrderRefundContext) {
    if (!ELIGIBLE_FOR_CLIENT_REQUEST.includes(order.current_status)) {
      throw new HttpException(
        'Refunds can only be requested for delivered (complete) orders',
        HttpStatus.BAD_REQUEST
      );
    }
    if (!isOrderRefundRequestAllowed(order.completed_at)) {
      throw new HttpException(
        'Return window has expired or completion time is missing; refunds are only available within 3 days after order completion',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async assertNoPendingRefundRequest(orderId: string) {
    const q = `
      query Pending($oid: uuid!) {
        order_refund_requests(
          where: { order_id: { _eq: $oid }, status: { _eq: pending } }
          limit: 1
        ) {
          id
        }
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

  private async getPendingRefundRequestRow(orderId: string): Promise<{ id: string } | null> {
    const q = `
      query P($oid: uuid!) {
        order_refund_requests(
          where: { order_id: { _eq: $oid }, status: { _eq: pending } }
          limit: 1
        ) {
          id
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_requests: { id: string }[];
    }>(q, { oid: orderId });
    return res.order_refund_requests[0] ?? null;
  }

  private async setOrderStatus(orderId: string, status: string) {
    const m = `
      mutation SetOrderStatus($id: uuid!, $status: order_status!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: { current_status: $status, updated_at: "now()" }
        ) {
          id
          current_status
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(m, {
      id: orderId,
      status,
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
          order_id: $orderId,
          status: $status,
          notes: $notes,
          changed_by_type: $changedByType,
          changed_by_user_id: $changedByUserId
        }]) {
          affected_rows
        }
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
