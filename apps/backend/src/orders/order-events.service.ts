import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type {
  OrderEventActorType,
  OrderEventType,
} from './order-pickup.types';

export interface OrderEventRow {
  id: string;
  order_id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface RecordOrderEventParams {
  orderId: string;
  eventType: OrderEventType;
  actorType: OrderEventActorType;
  actorId?: string | null;
  payload?: Record<string, unknown>;
}

@Injectable()
export class OrderEventsService {
  private readonly logger = new Logger(OrderEventsService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  /** Best effort: an insert failure is logged, never thrown. */
  async recordEvent(params: RecordOrderEventParams): Promise<void> {
    try {
      await this.recordEventStrict(params);
    } catch (error: any) {
      this.logger.error(
        `recordEvent ${params.eventType} failed for ${params.orderId}: ${error?.message}`
      );
    }
  }

  /** Same insert, but a failure is thrown so the caller can alert on it. */
  async recordEventStrict(params: RecordOrderEventParams): Promise<void> {
    {
      await this.hasura.executeMutation(
        `mutation InsertOrderEvent(
          $orderId: uuid!
          $eventType: String!
          $actorType: String!
          $actorId: uuid
          $payload: jsonb!
        ) {
          insert_order_events_one(object: {
            order_id: $orderId
            event_type: $eventType
            actor_type: $actorType
            actor_id: $actorId
            payload: $payload
          }) { id }
        }`,
        {
          orderId: params.orderId,
          eventType: params.eventType,
          actorType: params.actorType,
          actorId: params.actorId ?? null,
          payload: params.payload ?? {},
        }
      );
    }
  }

  async listForOrder(orderId: string, limit = 100): Promise<OrderEventRow[]> {
    const res = await this.hasura.executeQuery(
      `query OrderEvents($orderId: uuid!, $limit: Int!) {
        order_events(
          where: { order_id: { _eq: $orderId } }
          order_by: { created_at: desc }
          limit: $limit
        ) {
          id order_id event_type actor_type actor_id payload created_at
        }
      }`,
      { orderId, limit }
    );
    return (res.order_events ?? []) as OrderEventRow[];
  }
}
