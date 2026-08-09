import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
} from './notification.types';

export interface TrackNotificationEventInput {
  notificationType: NotificationType | string;
  category: NotificationCategory;
  userId?: string | null;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  providerMessageId?: string;
  dedupeKey?: string;
  entityType?: string;
  entityId?: string;
  errorCode?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class NotificationAnalyticsService {
  private readonly logger = new Logger(NotificationAnalyticsService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async track(input: TrackNotificationEventInput): Promise<void> {
    try {
      await this.hasura.executeMutation(
        `mutation T($object: notification_events_insert_input!) {
          insert_notification_events_one(object: $object) { id }
        }`,
        {
          object: {
            notification_type: input.notificationType,
            category: input.category,
            user_id: input.userId || null,
            channel: input.channel,
            status: input.status,
            provider_message_id: input.providerMessageId ?? null,
            dedupe_key: input.dedupeKey ?? null,
            entity_type: input.entityType ?? null,
            entity_id: input.entityId ?? null,
            error_code: input.errorCode ?? null,
            meta: input.meta ?? null,
          },
        }
      );
    } catch (error: any) {
      this.logger.warn(
        `notification analytics track failed: ${error?.message ?? String(error)}`
      );
    }
  }

  async markByProviderMessageId(
    providerMessageId: string,
    status: NotificationDeliveryStatus,
    meta?: Record<string, unknown>
  ): Promise<void> {
    if (!providerMessageId) return;
    try {
      await this.hasura.executeMutation(
        `mutation U($id: String!, $status: String!, $meta: jsonb) {
          insert_notification_events_one(object: {
            notification_type: "whatsapp.webhook"
            category: "actionable"
            channel: "whatsapp"
            status: $status
            provider_message_id: $id
            meta: $meta
          }) { id }
        }`,
        { id: providerMessageId, status, meta: meta ?? null }
      );
    } catch (error: any) {
      this.logger.warn(
        `markByProviderMessageId failed: ${error?.message ?? String(error)}`
      );
    }
  }
}
