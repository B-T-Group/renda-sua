import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationOrchestrator } from '../notifications/orchestration/notification-orchestrator.service';

const GET_UNPROCESSED_RESTOCK_EVENTS = `
  query GetUnprocessedRestockEvents($since: timestamptz!) {
    restock_events(
      where: {
        processed: { _eq: false }
        created_at: { _lte: $since }
      }
      order_by: { created_at: asc }
      limit: 100
    ) {
      id
      inventory_id
      item_id
      business_location_id
      available_quantity
      created_at
    }
  }
`;

const GET_ARMED_ALERTS_FOR_ITEM = `
  query GetArmedAlertsForItem($itemId: uuid!) {
    restock_alerts(
      where: {
        item_id: { _eq: $itemId }
        status: { _eq: "armed" }
        alert_enabled: { _eq: true }
        armed_at: { _gte: $expiryThreshold }
      }
    ) {
      id
      user_id
      item_id
      inventory_id
      last_sent_at
      sent_count
      armed_at
      user {
        id
        profile {
          first_name
          last_name
          preferred_language
        }
        user_notification_preferences {
          restock_alerts_push_enabled
          restock_alerts_whatsapp_enabled
          restock_alerts_sms_enabled
          push_enabled
          whatsapp_enabled
          sms_enabled
        }
        market_state {
          timezone
        }
      }
    }
  }
`;

const GET_ITEM_DETAILS = `
  query GetItemDetails($itemId: uuid!, $inventoryId: uuid!) {
    items_by_pk(id: $itemId) {
      id
      name
      currency
      price
      business {
        id
        name
      }
    }
    business_inventory_by_pk(id: $inventoryId) {
      id
      quantity
      reserved_quantity
      business_location_id
    }
  }
`;

const CHECK_USER_RECENT_SENDS = `
  query CheckUserRecentSends($userId: uuid!, $since24h: timestamptz!) {
    restock_alert_sends(
      where: {
        user_id: { _eq: $userId }
        sent_at: { _gte: $since24h }
        is_digest: { _eq: false }
      }
      order_by: { sent_at: desc }
    ) {
      id
      sent_at
      item_id
    }
  }
`;

const CHECK_ITEM_RECENT_FANOUT = `
  query CheckItemRecentFanout($itemId: uuid!, $since6h: timestamptz!) {
    restock_alert_sends_aggregate(
      where: {
        item_id: { _eq: $itemId }
        sent_at: { _gte: $since6h }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

const MARK_EVENT_PROCESSED = `
  mutation MarkEventProcessed($eventId: uuid!, $alertsSent: Int!) {
    update_restock_events_by_pk(
      pk_columns: { id: $eventId }
      _set: {
        processed: true
        processed_at: "now()"
        alerts_sent_count: $alertsSent
      }
    ) {
      id
    }
  }
`;

const UPDATE_ALERT_SENT = `
  mutation UpdateAlertSent($alertId: uuid!, $sentAt: timestamptz!) {
    update_restock_alerts_by_pk(
      pk_columns: { id: $alertId }
      _set: {
        status: "sent"
        last_sent_at: $sentAt
        sent_count: ${'"sent_count" + 1'}
      }
    ) {
      id
    }
  }
`;

const INSERT_ALERT_SEND = `
  mutation InsertAlertSend(
    $userId: uuid!
    $itemId: uuid!
    $restockEventId: uuid!
    $channel: String!
    $isDigest: Boolean!
    $quantityShown: Int
  ) {
    insert_restock_alert_sends_one(
      object: {
        user_id: $userId
        item_id: $itemId
        restock_event_id: $restockEventId
        channel: $channel
        is_digest: $isDigest
        quantity_shown: $quantityShown
      }
    ) {
      id
    }
  }
`;

interface RestockEventRow {
  id: string;
  inventory_id: string;
  item_id: string;
  business_location_id: string;
  available_quantity: number;
  created_at: string;
}

interface ArmedAlertRow {
  id: string;
  user_id: string;
  item_id: string;
  inventory_id: string | null;
  last_sent_at: string | null;
  sent_count: number;
  armed_at: string;
  user: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
      preferred_language: string | null;
    } | null;
    user_notification_preferences: {
      restock_alerts_push_enabled: boolean;
      restock_alerts_whatsapp_enabled: boolean;
      restock_alerts_sms_enabled: boolean;
      push_enabled: boolean;
      whatsapp_enabled: boolean;
      sms_enabled: boolean;
    } | null;
    market_state: {
      timezone: string;
    } | null;
  };
}

@Injectable()
export class RestockAlertsService {
  private readonly logger = new Logger(RestockAlertsService.name);
  
  // AC-2.2: Debounce window
  private readonly DEBOUNCE_MINUTES = 10;
  
  // AC-2.3: Cooldown between alerts for the same user-item
  private readonly COOLDOWN_HOURS = 24;
  
  // AC-2.4: Per-item fan-out cap window
  private readonly FANOUT_CAP_HOURS = 6;
  
  // AC-2.7: Quiet hours
  private readonly QUIET_HOURS_START = 21;
  private readonly QUIET_HOURS_END = 8;
  
  // AC-2.5: Daily cap per user
  private readonly DAILY_CAP = 3;
  
  // AC-§1: Expiry
  private readonly EXPIRY_DAYS = 90;

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationOrchestrator: NotificationOrchestrator
  ) {}

  /**
   * Cron job that processes restock events every minute
   * AC-2.2: Events are processed after the debounce window (10 minutes)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processRestockEvents(): Promise<void> {
    try {
      const debounceThreshold = new Date(
        Date.now() - this.DEBOUNCE_MINUTES * 60 * 1000
      ).toISOString();

      const result = await this.hasuraSystemService.executeQuery<{
        restock_events: RestockEventRow[];
      }>(GET_UNPROCESSED_RESTOCK_EVENTS, { since: debounceThreshold });

      for (const event of result.restock_events) {
        await this.processRestockEvent(event);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to process restock events: ${error?.message}`,
        error?.stack
      );
    }
  }

  private async processRestockEvent(event: RestockEventRow): Promise<void> {
    try {
      // AC-2.8: Re-verify availability before sending
      const itemDetails = await this.hasuraSystemService.executeQuery<{
        items_by_pk: {
          id: string;
          name: string;
          currency: string;
          price: number;
          business: {
            id: string;
            name: string;
          };
        } | null;
        business_inventory_by_pk: {
          id: string;
          quantity: number;
          reserved_quantity: number;
          business_location_id: string;
        } | null;
      }>(GET_ITEM_DETAILS, {
        itemId: event.item_id,
        inventoryId: event.inventory_id,
      });

      const item = itemDetails.items_by_pk;
      const inventory = itemDetails.business_inventory_by_pk;

      if (!item || !inventory) {
        this.logger.warn(`Item or inventory not found for event ${event.id}`);
        await this.markEventProcessed(event.id, 0);
        return;
      }

      const currentAvailable = inventory.quantity - (inventory.reserved_quantity || 0);
      if (currentAvailable < 1) {
        this.logger.debug(`Item ${item.id} sold out again before sending alerts`);
        await this.markEventProcessed(event.id, 0);
        return;
      }

      // AC-2.4: Check per-item fan-out cap (max 1 per 6 hours)
      const fanoutCheck = await this.hasuraSystemService.executeQuery<{
        restock_alert_sends_aggregate: {
          aggregate: { count: number } | null;
        };
      }>(CHECK_ITEM_RECENT_FANOUT, {
        itemId: event.item_id,
        since6h: new Date(Date.now() - this.FANOUT_CAP_HOURS * 60 * 60 * 1000).toISOString(),
      });

      if ((fanoutCheck.restock_alert_sends_aggregate?.aggregate?.count || 0) > 0) {
        this.logger.debug(`Item ${item.id} hit fan-out cap, skipping`);
        await this.markEventProcessed(event.id, 0);
        return;
      }

      // Get armed alerts for this item
      const expiryThreshold = new Date(
        Date.now() - this.EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      
      const alertsResult = await this.hasuraSystemService.executeQuery<{
        restock_alerts: ArmedAlertRow[];
      }>(GET_ARMED_ALERTS_FOR_ITEM, { itemId: event.item_id, expiryThreshold });

      let sentCount = 0;
      for (const alert of alertsResult.restock_alerts) {
        const sent = await this.sendAlertIfEligible(alert, item, currentAvailable, event.id);
        if (sent) sentCount++;
      }

      await this.markEventProcessed(event.id, sentCount);
      this.logger.log(`Processed restock event ${event.id}: ${sentCount} alerts sent`);
    } catch (error: any) {
      this.logger.error(
        `Failed to process restock event ${event.id}: ${error?.message}`,
        error?.stack
      );
      // Don't mark as processed so it can be retried
    }
  }

  private async sendAlertIfEligible(
    alert: ArmedAlertRow,
    item: { id: string; name: string; currency: string; price: number; business: { id: string; name: string } },
    availableQuantity: number,
    restockEventId: string
  ): Promise<boolean> {
    try {
      // AC-2.3: Check 24h cooldown
      if (alert.last_sent_at) {
        const hoursSinceLastSend =
          (Date.now() - new Date(alert.last_sent_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastSend < this.COOLDOWN_HOURS) {
          this.logger.debug(
            `User ${alert.user_id} in cooldown for item ${item.id}`
          );
          return false;
        }
      }

      // AC-2.5: Check daily cap
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentSends = await this.hasuraSystemService.executeQuery<{
        restock_alert_sends: Array<{ id: string; sent_at: string; item_id: string | null }>;
      }>(CHECK_USER_RECENT_SENDS, {
        userId: alert.user_id,
        since24h,
      });

      if (recentSends.restock_alert_sends.length >= this.DAILY_CAP) {
        this.logger.debug(
          `User ${alert.user_id} hit daily cap (${this.DAILY_CAP})`
        );
        // TODO: Queue for digest
        return false;
      }

      // AC-2.7: Check quiet hours
      const timezone = alert.user.market_state?.timezone || 'UTC';
      if (this.isQuietHours(timezone)) {
        this.logger.debug(
          `Quiet hours for user ${alert.user_id}, queueing to 08:00`
        );
        // TODO: Queue to 08:00 in user's timezone
        return false;
      }

      // AC-2.9: Select ONE channel (push > WhatsApp > SMS)
      const channel = this.selectNotificationChannel(alert);
      if (!channel) {
        this.logger.debug(
          `No enabled channel for user ${alert.user_id}`
        );
        return false;
      }

      // Send the notification
      await this.sendRestockNotification(
        alert.user_id,
        item,
        availableQuantity,
        channel,
        alert.user.profile?.preferred_language || 'en'
      );

      // Record the send
      await this.hasuraSystemService.executeMutation(INSERT_ALERT_SEND, {
        userId: alert.user_id,
        itemId: item.id,
        restockEventId,
        channel,
        isDigest: false,
        quantityShown: availableQuantity <= 5 ? availableQuantity : null,
      });

      // Update alert status
      await this.hasuraSystemService.executeMutation(UPDATE_ALERT_SENT, {
        alertId: alert.id,
        sentAt: new Date().toISOString(),
      });

      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to send alert for user ${alert.user_id}: ${error?.message}`,
        error?.stack
      );
      return false;
    }
  }

  private selectNotificationChannel(alert: ArmedAlertRow): 'push' | 'whatsapp' | 'sms' | null {
    const prefs = alert.user.user_notification_preferences;
    if (!prefs) return null;

    // AC-2.9: Push first
    if (prefs.restock_alerts_push_enabled && prefs.push_enabled) {
      return 'push';
    }

    // WhatsApp second
    if (prefs.restock_alerts_whatsapp_enabled && prefs.whatsapp_enabled) {
      return 'whatsapp';
    }

    // SMS third
    if (prefs.restock_alerts_sms_enabled && prefs.sms_enabled) {
      return 'sms';
    }

    return null;
  }

  private isQuietHours(timezone: string): boolean {
    try {
      const now = new Date();
      const userTime = new Date(
        now.toLocaleString('en-US', { timeZone: timezone })
      );
      const hour = userTime.getHours();
      return hour >= this.QUIET_HOURS_START || hour < this.QUIET_HOURS_END;
    } catch (error: any) {
      this.logger.warn(`Failed to check quiet hours for timezone ${timezone}`);
      return false;
    }
  }

  private async sendRestockNotification(
    userId: string,
    item: { id: string; name: string; currency: string; price: number; business: { name: string } },
    availableQuantity: number,
    channel: 'push' | 'whatsapp' | 'sms',
    locale: string
  ): Promise<void> {
    // Use general deep link format until we verify the correct method
    const deepLink = `https://rendasua.com/item/${item.id}?src=restock_alert`;
    
    const title = locale === 'fr' 
      ? `${item.name} est de retour`
      : `${item.name} is back`;
    
    const body = this.getNotificationBody(item, availableQuantity, locale);

    if (channel === 'push') {
      await this.notificationOrchestrator.notify({
        type: 'product.interest',
        category: 'informational',
        recipientUserId: userId,
        locale: locale as 'en' | 'fr',
        preferenceCategory: 'marketplace',
        channels: {
          push: {
            title,
            body,
            data: {
              type: 'restock_alert',
              itemId: item.id,
              deepLink,
            },
          },
        },
      });
    }
    
    // TODO: Implement WhatsApp and SMS channels
  }

  private getNotificationBody(
    item: { business: { name: string } },
    availableQuantity: number,
    locale: string
  ): string {
    if (availableQuantity <= 5) {
      return locale === 'fr'
        ? `Plus que ${availableQuantity} chez ${item.business.name}.`
        : `Only ${availableQuantity} left at ${item.business.name}.`;
    }
    return locale === 'fr'
      ? `Disponible chez ${item.business.name}.`
      : `Available now at ${item.business.name}.`;
  }

  private async markEventProcessed(
    eventId: string,
    alertsSent: number
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(MARK_EVENT_PROCESSED, {
      eventId,
      alertsSent,
    });
  }
}
