import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  assertTransition,
  ExportOrderStatus,
} from './export-order.statuses';
import { GET_EXPORT_ORDER, INSERT_AUDIT, UPDATE_EXPORT_ORDER } from './export-orders.queries';
import type { ExportOrderRow } from './export-orders.types';

type TransitionParams = {
  orderId: string;
  to: ExportOrderStatus;
  eventName: string;
  actorUserId?: string | null;
  actorRole?: string;
  payload?: Record<string, unknown>;
  extraSet?: Record<string, unknown>;
};

@Injectable()
export class ExportOrdersTransitionService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly events: EventEmitter2
  ) {}

  async getOrder(id: string): Promise<ExportOrderRow> {
    const res = await this.hasura.executeQuery<{
      export_orders_by_pk: ExportOrderRow | null;
    }>(GET_EXPORT_ORDER, { id });
    if (!res.export_orders_by_pk) {
      throw new HttpException('Export order not found', HttpStatus.NOT_FOUND);
    }
    return res.export_orders_by_pk;
  }

  async transition(params: TransitionParams): Promise<ExportOrderRow> {
    const order = await this.getOrder(params.orderId);
    this.assertAllowed(order.status, params.to);
    await this.claimStatus(order.status, params);
    await this.insertAudit(order.status, params);
    this.events.emit(params.eventName, {
      orderId: params.orderId,
      from: order.status,
      to: params.to,
    });
    return this.getOrder(params.orderId);
  }

  private assertAllowed(from: string, to: ExportOrderStatus): void {
    try {
      assertTransition(from as ExportOrderStatus, to);
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Invalid transition',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async claimStatus(
    from: string,
    params: TransitionParams
  ): Promise<void> {
    const res = await this.hasura.executeMutation<{
      update_export_orders: { affected_rows: number } | null;
    }>(UPDATE_EXPORT_ORDER, {
      id: params.orderId,
      from,
      set: {
        status: params.to,
        updated_at: new Date().toISOString(),
        ...(params.extraSet ?? {}),
      },
    });
    if ((res.update_export_orders?.affected_rows ?? 0) !== 1) {
      throw new HttpException(
        'Export order status changed',
        HttpStatus.CONFLICT
      );
    }
  }

  private async insertAudit(
    from: string,
    params: TransitionParams
  ): Promise<void> {
    await this.hasura.executeMutation(INSERT_AUDIT, {
      object: {
        export_order_id: params.orderId,
        from_status: from,
        to_status: params.to,
        event_name: params.eventName,
        actor_user_id: params.actorUserId ?? null,
        actor_role: params.actorRole ?? null,
        payload: params.payload ?? {},
      },
    });
  }
}
