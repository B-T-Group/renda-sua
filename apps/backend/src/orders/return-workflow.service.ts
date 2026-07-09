import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { ReturnStatus } from './refund.types';
import { RefundEventService } from './refund-event.service';

@Injectable()
export class ReturnWorkflowService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly refundEventService: RefundEventService
  ) {}

  async requestReturn(refundRequestId: string, instructions?: string): Promise<void> {
    await this.ensureBusinessOwnsRequest(refundRequestId);
    await this.upsertReturn(refundRequestId, 'requested', instructions);
    await this.patchRequest(refundRequestId, {
      return_required: true,
      return_status: 'requested',
    });
    await this.refundEventService.appendEvent({
      refundRequestId,
      eventType: 'return_requested',
      actorType: 'business',
      actorUserId: (await this.hasuraUserService.getUser()).id,
      payload: { instructions: instructions ?? null },
    });
  }

  async markReceived(refundRequestId: string, notes?: string): Promise<void> {
    await this.ensureBusinessOwnsRequest(refundRequestId);
    const now = new Date().toISOString();
    await this.upsertReturn(refundRequestId, 'received', undefined, {
      received_at: now,
      inspection_notes: notes ?? null,
    });
    await this.patchRequest(refundRequestId, { return_status: 'received' });
    await this.refundEventService.appendEvent({
      refundRequestId,
      eventType: 'return_received',
      actorType: 'business',
      actorUserId: (await this.hasuraUserService.getUser()).id,
    });
  }

  async confirmReturnShipped(refundRequestId: string): Promise<void> {
    const user = await this.hasuraUserService.getUser();
    await this.ensureClientOwnsRequest(refundRequestId, user.id);
    await this.upsertReturn(refundRequestId, 'in_transit');
    await this.patchRequest(refundRequestId, { return_status: 'in_transit' });
    await this.refundEventService.appendEvent({
      refundRequestId,
      eventType: 'return_in_transit',
      actorType: 'client',
      actorUserId: user.id,
    });
  }

  private async upsertReturn(
    refundRequestId: string,
    status: ReturnStatus,
    instructions?: string,
    extra?: Record<string, unknown>
  ): Promise<void> {
    const mutation = `
      mutation UpsertReturn($object: order_returns_insert_input!) {
        insert_order_returns_one(
          object: $object
          on_conflict: {
            constraint: order_returns_refund_request_id_key
            update_columns: [status, instructions, received_at, inspected_at, inspection_notes, updated_at]
          }
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      object: {
        refund_request_id: refundRequestId,
        status,
        instructions: instructions ?? null,
        ...extra,
      },
    });
  }

  private async patchRequest(
    refundRequestId: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    const mutation = `
      mutation PatchReq($id: uuid!, $set: order_refund_requests_set_input!) {
        update_order_refund_requests_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      id: refundRequestId,
      set: fields,
    });
  }

  private async ensureBusinessOwnsRequest(refundRequestId: string): Promise<void> {
    const user = await this.hasuraUserService.getUser();
    const row = await this.fetchRequest(refundRequestId);
    if (row.business_user_id !== user.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private async ensureClientOwnsRequest(
    refundRequestId: string,
    userId: string
  ): Promise<void> {
    const row = await this.fetchRequest(refundRequestId);
    if (row.client_user_id !== userId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private async fetchRequest(refundRequestId: string): Promise<{
    business_user_id: string;
    client_user_id: string;
  }> {
    const query = `
      query Req($id: uuid!) {
        order_refund_requests_by_pk(id: $id) {
          business { user_id }
          client { user_id }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_requests_by_pk: {
        business: { user_id: string };
        client: { user_id: string };
      } | null;
    }>(query, { id: refundRequestId });
    const row = res.order_refund_requests_by_pk;
    if (!row) {
      throw new HttpException('Refund request not found', HttpStatus.NOT_FOUND);
    }
    return {
      business_user_id: row.business.user_id,
      client_user_id: row.client.user_id,
    };
  }
}
