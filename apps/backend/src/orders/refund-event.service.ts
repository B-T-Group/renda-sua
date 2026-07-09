import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type RefundEventActorType = 'client' | 'business' | 'admin' | 'system';

@Injectable()
export class RefundEventService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async appendEvent(params: {
    refundRequestId: string;
    eventType: string;
    actorType?: RefundEventActorType;
    actorUserId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const mutation = `
      mutation AppendRefundEvent($object: order_refund_events_insert_input!) {
        insert_order_refund_events_one(object: $object) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      object: {
        refund_request_id: params.refundRequestId,
        event_type: params.eventType,
        actor_type: params.actorType ?? 'system',
        actor_user_id: params.actorUserId ?? null,
        payload: params.payload ?? null,
      },
    });
  }

  async listEvents(refundRequestId: string): Promise<Record<string, unknown>[]> {
    const query = `
      query RefundEvents($id: uuid!) {
        order_refund_events(
          where: { refund_request_id: { _eq: $id } }
          order_by: { created_at: asc }
        ) {
          id
          event_type
          actor_type
          actor_user_id
          payload
          created_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_refund_events: Record<string, unknown>[];
    }>(query, { id: refundRequestId });
    return res.order_refund_events ?? [];
  }
}
