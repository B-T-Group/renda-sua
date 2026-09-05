import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';

interface ReminderOrderRow {
  id: string;
  order_number: string;
  updated_at?: string | null;
  pickup_reminder_last_sent_at?: string | null;
  client?: {
    user_id?: string | null;
    user?: { preferred_language?: string | null } | null;
  } | null;
  order_status_history?: Array<{ status?: string | null; created_at?: string }>;
}

/**
 * Hourly scan: remind clients every N hours while a store-pickup order
 * sits in ready_for_pickup (until the 7-day cancel window).
 */
@Injectable()
export class StorePickupReminderService {
  private readonly logger = new Logger(StorePickupReminderService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  async runHourlyReminders(): Promise<{ sent: number; skipped?: boolean }> {
    const cfg = this.configService.get<Configuration['order']>('order');
    if (cfg?.storePickupReminderEnabled === false) {
      return { sent: 0, skipped: true };
    }
    const reminderHours = cfg?.storePickupReminderHours ?? 24;
    const cancelDays = cfg?.storePickupCancelDays ?? 7;
    const limit = cfg?.cleanupBatchLimit ?? 100;
    const now = Date.now();
    const reminderMs = reminderHours * 60 * 60 * 1000;
    const cancelMs = cancelDays * 24 * 60 * 60 * 1000;

    const orders = await this.queryCandidates(limit);
    let sent = 0;
    for (const order of orders) {
      const readyAt = this.resolveReadyAt(order);
      if (!readyAt) continue;
      const age = now - readyAt.getTime();
      if (age < reminderMs || age >= cancelMs) continue;
      const lastSent = order.pickup_reminder_last_sent_at
        ? Date.parse(order.pickup_reminder_last_sent_at)
        : NaN;
      if (Number.isFinite(lastSent) && now - lastSent < reminderMs) continue;
      const clientUserId = order.client?.user_id?.trim();
      if (!clientUserId) continue;
      await this.notifications.sendStorePickupReminderPush({
        clientUserId,
        orderId: order.id,
        orderNumber: order.order_number,
        preferredLanguage: order.client?.user?.preferred_language,
      });
      await this.markReminderSent(order.id);
      sent += 1;
    }
    if (sent > 0) {
      this.logger.log(`Store pickup reminders sent=${sent}`);
    }
    return { sent };
  }

  private resolveReadyAt(order: ReminderOrderRow): Date | null {
    const history = order.order_status_history ?? [];
    const readyRows = history
      .filter((row) => row.status === 'ready_for_pickup' && row.created_at)
      .map((row) => new Date(row.created_at as string))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (readyRows[0]) return readyRows[0];
    if (order.updated_at) {
      const updated = new Date(order.updated_at);
      if (!Number.isNaN(updated.getTime())) return updated;
    }
    return null;
  }

  private async queryCandidates(limit: number): Promise<ReminderOrderRow[]> {
    const res = await this.hasura.executeQuery<{ orders: ReminderOrderRow[] }>(
      `
      query StorePickupReminderCandidates($limit: Int!) {
        orders(
          where: {
            current_status: { _eq: ready_for_pickup }
            fulfillment_method: { _eq: pickup }
          }
          order_by: [{ pickup_reminder_last_sent_at: asc_nulls_first }, { updated_at: asc }]
          limit: $limit
        ) {
          id
          order_number
          updated_at
          pickup_reminder_last_sent_at
          client { user_id user { preferred_language } }
          order_status_history(
            where: { status: { _eq: ready_for_pickup } }
            order_by: { created_at: asc }
            limit: 1
          ) {
            status
            created_at
          }
        }
      }
    `,
      { limit }
    );
    return res.orders ?? [];
  }

  private async markReminderSent(orderId: string): Promise<void> {
    await this.hasura.executeMutation(
      `
      mutation MarkPickupReminderSent($id: uuid!, $at: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: { pickup_reminder_last_sent_at: $at }
        ) { id }
      }
    `,
      { id: orderId, at: new Date().toISOString() }
    );
  }
}
