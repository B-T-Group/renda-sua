import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { FailedDeliveriesService } from '../orders/failed-deliveries.service';
import { OrdersService } from '../orders/orders.service';
import { ClientConfirmDeliveryRepository } from './client-confirm-delivery.repository';
import type { DeliveryReportOutcome } from './client-confirm-delivery.constants';
import { ClientConfirmMarketConfigService } from './client-confirm-market-config.service';

export const DISPUTE_RESOLUTIONS = [
  'complete',
  'agent_fault',
  'item_fault',
  'client_fault',
] as const;
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

/** Default report outcome per resolution (feeds the repeat-reporter flag). */
export const DEFAULT_OUTCOME: Record<DisputeResolution, DeliveryReportOutcome> = {
  complete: 'unsupported',
  client_fault: 'unsupported',
  agent_fault: 'supported',
  item_fault: 'supported',
};

export const CLIENT_REPORTED_REASON_KEY = 'client_reported_not_delivered';

export interface ResolveDisputeInput {
  resolution: DisputeResolution;
  note?: string | null;
  outcome?: DeliveryReportOutcome;
  restoreInventory?: boolean;
}

export interface DisputeListRow {
  order: Record<string, any>;
  reports: Record<string, any>[];
  clientUnsupportedReports: number;
  clientFlagged: boolean;
}

/**
 * Admin queue for client delivery reports. Disputed orders never auto-complete,
 * so the agent hold stays locked until one of these resolutions runs.
 */
@Injectable()
export class AdminDeliveryDisputesService {
  private readonly logger = new Logger(AdminDeliveryDisputesService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly repo: ClientConfirmDeliveryRepository,
    private readonly marketConfig: ClientConfirmMarketConfigService,
    private readonly orders: OrdersService,
    private readonly failedDeliveries: FailedDeliveriesService
  ) {}

  async list(scope: 'open' | 'all' = 'open', limit = 100): Promise<DisputeListRow[]> {
    const where =
      scope === 'open'
        ? { current_status: { _eq: 'disputed' }, dispute_opened_at: { _is_null: false } }
        : { dispute_opened_at: { _is_null: false } };
    const res = await this.hasura.executeQuery<{ orders: any[] }>(
      `query AdminDeliveryDisputes($where: orders_bool_exp!, $limit: Int!) {
        orders(where: $where, order_by: { dispute_opened_at: desc }, limit: $limit) {
          id order_number current_status currency total_amount fulfillment_country
          delivered_at dispute_type dispute_reason dispute_opened_at
          awaiting_confirm_support_ticket_id client_id
          client { id user { id first_name last_name phone_number email } }
          assigned_agent { id user { first_name last_name phone_number } }
          business { id name }
          delivery_reports(order_by: { created_at: asc }) {
            id report_type reason note photo_urls item_ids phase outcome
            resolution admin_note resolved_at created_at support_ticket_id
          }
        }
      }`,
      { where, limit: Math.min(Math.max(limit, 1), 500) }
    );
    const markets = new Map<string, { threshold: number; since: string }>();
    const counts = new Map<string, number>();
    const rows: DisputeListRow[] = [];
    for (const o of res.orders ?? []) {
      const { delivery_reports, ...order } = o;
      const country = (o.fulfillment_country as string) ?? '';
      if (!markets.has(country)) {
        const m = await this.marketConfig.forOrder({ fulfillment_country: country || null });
        markets.set(country, {
          threshold: m.clientFlagThreshold,
          since: new Date(Date.now() - m.clientFlagWindowDays * 86_400_000).toISOString(),
        });
      }
      const { threshold, since } = markets.get(country)!;
      const clientId = o.client_id as string;
      const key = `${clientId}|${since}`;
      if (clientId && !counts.has(key)) {
        counts.set(key, await this.repo.countUnsupportedReports(clientId, since));
      }
      const n = counts.get(key) ?? 0;
      rows.push({
        order,
        reports: delivery_reports ?? [],
        clientUnsupportedReports: n,
        clientFlagged: n >= threshold,
      });
    }
    return rows;
  }

  async resolve(orderId: string, input: ResolveDisputeInput) {
    if (!DISPUTE_RESOLUTIONS.includes(input.resolution)) {
      throw new HttpException('Invalid resolution', HttpStatus.BAD_REQUEST);
    }
    const admin = await this.users.getUser();
    const order = await this.repo.loadOrder(orderId);
    if (!order) throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.current_status !== 'disputed') {
      throw new HttpException(
        `Order is ${order.current_status}, not disputed`,
        HttpStatus.CONFLICT
      );
    }
    const note = (input.note ?? '').trim().slice(0, 1000) || null;
    const label = `Delivery report resolved by admin: ${input.resolution}${note ? ` — ${note}` : ''}`;
    if (input.resolution === 'complete') {
      const r = await this.orders.completeAfterClientConfirmation(orderId, label, 'admin', {
        fromDisputed: true,
        changedByUserId: admin.id,
      });
      if (r.alreadyComplete) {
        throw new HttpException('Order was already resolved', HttpStatus.CONFLICT);
      }
    } else {
      const reasonId = await this.clientReportedReasonId();
      const won = await this.orders.failDisputedDelivery(orderId, reasonId, label, admin.id);
      if (!won) throw new HttpException('Order was already resolved', HttpStatus.CONFLICT);
      await this.failedDeliveries.resolveFailedDeliveryForActor(
        orderId,
        {
          resolution_type: input.resolution,
          outcome: label,
          restore_inventory: input.restoreInventory ?? true,
        },
        { userId: admin.id, businessId: (order as any).business_id, locationId: '' }
      );
    }
    const outcome = input.outcome ?? DEFAULT_OUTCOME[input.resolution];
    const at = new Date().toISOString();
    const updated = await this.repo.resolveReports({
      orderId,
      outcome,
      resolution: input.resolution,
      adminUserId: admin.id,
      note,
      at,
    });
    this.logger.log(`Dispute ${orderId} resolved: ${input.resolution} (${updated} reports)`);
    return { success: true, orderId, resolution: input.resolution, outcome, reportsResolved: updated };
  }

  private async clientReportedReasonId(): Promise<string> {
    const res = await this.hasura.executeQuery<{ delivery_failure_reasons: { id: string }[] }>(
      `query ClientReportedReason($key: String!) {
        delivery_failure_reasons(where: { reason_key: { _eq: $key } }, limit: 1) { id }
      }`,
      { key: CLIENT_REPORTED_REASON_KEY }
    );
    const id = res.delivery_failure_reasons?.[0]?.id;
    if (!id) {
      throw new HttpException('Failure reason seed missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return id;
  }
}
