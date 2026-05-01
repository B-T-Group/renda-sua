import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Expo } from 'expo-server-sdk';
import { Resend } from 'resend';
import * as webPush from 'web-push';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  buildProximityVariables,
  buildResendTemplateVariables,
  normalizeLanguage,
  type EmailLocale,
} from './email-template-data';
import type {
  AgentOrderPaymentFailedEmailPayload,
  BusinessRentalBookingRequestEmailPayload,
  ClientOrderPaymentFailedEmailPayload,
  ClientRentalRequestAcceptedEmailPayload,
  ClientRentalRequestRejectedEmailPayload,
  FirstOrderCompletedEmailPayload,
  NotificationData,
  ReferralRewardEmailPayload,
  RentalListingModerationEmailPayload,
  RentalListingRejectedEmailPayload,
  RentalPeriodEndedEmailPayload,
} from './notification-types';
import twilio = require('twilio');

export type {
  AgentOrderPaymentFailedEmailPayload,
  BusinessRentalBookingRequestEmailPayload,
  ClientOrderPaymentFailedEmailPayload,
  ClientRentalRequestAcceptedEmailPayload,
  ClientRentalRequestRejectedEmailPayload,
  FirstOrderCompletedEmailPayload,
  NotificationData,
  ReferralRewardEmailPayload,
  RentalListingModerationEmailPayload,
  RentalListingRejectedEmailPayload,
  RentalPeriodEndedEmailPayload,
} from './notification-types';

function escapeHtmlForEmail(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const RENTAL_REJECTION_REASONS: Record<
  EmailLocale,
  Record<string, string>
> = {
  en: {
    fully_booked: 'This listing is fully booked for the dates you requested.',
    dates_not_available: 'Those dates are not available from this business.',
    item_unavailable: 'The item is not available.',
    pricing_mismatch: 'The business could not match the requested pricing.',
  },
  fr: {
    fully_booked: 'Cette annonce est complète pour les dates demandées.',
    dates_not_available: 'Ces dates ne sont pas disponibles chez ce professionnel.',
    item_unavailable: "L'article n'est pas disponible.",
    pricing_mismatch: "Le professionnel n'a pas pu confirmer le tarif demandé.",
  },
};

function clientRentalRejectionReasonHtml(
  code: string,
  note: string | null | undefined,
  locale: EmailLocale
): string {
  const map = RENTAL_REJECTION_REASONS[locale] ?? RENTAL_REJECTION_REASONS.en;
  const n = note?.trim() ?? '';
  if (code === 'other') {
    return escapeHtmlForEmail(
      n ||
        (locale === 'fr' ? 'Aucun détail fourni.' : 'No details provided.')
    );
  }
  const head = map[code] ?? escapeHtmlForEmail(code);
  if (!n) return head;
  return `${head}<br><br>${escapeHtmlForEmail(n)}`;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private resendClient: Resend | null = null;
  private resendTemplateIds: Record<string, string> = {};
  private fromEmail = 'Rendasua <noreply@rendasua.com>';
  private expoClient: Expo | null = null;

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly hasuraSystemService: HasuraSystemService
  ) {
    this.loadResendTemplateIds();
  }

  private loadResendTemplateIds(): void {
    const candidates = [
      join(__dirname, 'resend-template-ids.json'),
      join(
        process.cwd(),
        'apps/backend/src/notifications/resend-template-ids.json'
      ),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        try {
          this.resendTemplateIds = JSON.parse(
            readFileSync(p, 'utf-8')
          ) as Record<string, string>;
          return;
        } catch (error: any) {
          this.logger.warn(`Could not read ${p}: ${error?.message ?? error}`);
        }
      }
    }
    this.logger.warn(
      'resend-template-ids.json not found — run npm run sync:resend-templates'
    );
  }

  private initializeResend(): void {
    if (this.resendClient) return;
    const emailConfig = this.configService.get('email');
    const key = emailConfig?.resendApiKey || '';
    this.fromEmail =
      emailConfig?.resendFromEmail || 'Rendasua <noreply@rendasua.com>';
    if (!key) {
      this.logger.warn(
        'RESEND_API_KEY not set — email notifications are disabled'
      );
      return;
    }
    try {
      this.resendClient = new Resend(key);
      this.logger.log('Resend client initialized');
    } catch (error: any) {
      this.logger.error('Failed to initialize Resend', error);
    }
  }

  private languageForRecipient(
    data: NotificationData,
    type: string
  ): EmailLocale {
    if (type === 'client') return normalizeLanguage(data.clientPreferredLanguage);
    if (type === 'business')
      return normalizeLanguage(data.businessPreferredLanguage);
    if (type === 'agent') return normalizeLanguage(data.agentPreferredLanguage);
    return 'fr';
  }

  private mapKeyForLanguage(baseKey: string, locale: EmailLocale): string {
    return locale === 'fr' ? `${baseKey}_fr` : baseKey;
  }

  /**
   * Send order creation notifications
   */
  async sendOrderCreatedNotifications(data: NotificationData): Promise<void> {
    try {
      const clientLocale = this.languageForRecipient(data, 'client');
      const businessLocale = this.languageForRecipient(data, 'business');
      await this.sendEmail({
        to: data.clientEmail,
        templateKey: this.mapKeyForLanguage('client_order_created', clientLocale),
        variables: buildResendTemplateVariables(data, 'client', clientLocale),
      });
      await this.sendEmail({
        to: data.businessEmail,
        templateKey: this.mapKeyForLanguage(
          'business_order_created',
          businessLocale
        ),
        variables: buildResendTemplateVariables(
          data,
          'business',
          businessLocale
        ),
      });

      this.logger.log(
        `Order creation notifications sent for order ${data.orderNumber}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send order creation notifications: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  async sendFirstOrderCompletedEmail(
    payload: FirstOrderCompletedEmailPayload
  ): Promise<void> {
    const locale = normalizeLanguage(payload.preferredLanguage);
    const name =
      payload.clientName?.trim() ||
      (locale === 'fr' ? 'votre compte' : 'there');

    await this.sendEmail({
      to: payload.to,
      templateKey: this.mapKeyForLanguage(
        'client_first_order_completed',
        locale
      ),
      variables: {
        recipientName: name,
        discountCode: payload.discountCode,
        orderUrl: payload.orderUrl,
        referralDiscountPct: 5,
        ownRewardPct: 5,
      },
    });
  }

  async sendReferralRewardEmail(payload: ReferralRewardEmailPayload): Promise<void> {
    const locale = normalizeLanguage(payload.preferredLanguage);
    const name =
      payload.clientName?.trim() ||
      (locale === 'fr' ? 'votre compte' : 'there');

    await this.sendEmail({
      to: payload.to,
      templateKey: this.mapKeyForLanguage('client_referral_reward', locale),
      variables: {
        recipientName: name,
        discountCode: payload.discountCode,
        ownRewardPct: 5,
      },
    });
  }

  async sendClientOrderPaymentFailedEmail(
    payload: ClientOrderPaymentFailedEmailPayload
  ): Promise<void> {
    const locale = normalizeLanguage(payload.preferredLanguage);
    const name =
      payload.clientName?.trim() || (locale === 'fr' ? 'votre compte' : 'there');

    await this.sendEmail({
      to: payload.to,
      templateKey: this.mapKeyForLanguage('client_order_payment_failed', locale),
      variables: {
        recipientName: name,
        orderNumber: payload.orderNumber,
        orderUrl: payload.orderUrl,
        failureMessage: payload.failureMessage,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  async sendAgentOrderPaymentFailedEmail(
    payload: AgentOrderPaymentFailedEmailPayload
  ): Promise<void> {
    const locale = normalizeLanguage(payload.preferredLanguage);
    const name =
      payload.agentName?.trim() || (locale === 'fr' ? 'votre compte' : 'there');

    await this.sendEmail({
      to: payload.to,
      templateKey: this.mapKeyForLanguage('agent_order_payment_failed', locale),
      variables: {
        recipientName: name,
        orderNumber: payload.orderNumber,
        orderUrl: payload.orderUrl,
        failureMessage: payload.failureMessage,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  async sendRentalPeriodEndedEmails(
    payload: RentalPeriodEndedEmailPayload
  ): Promise<void> {
    try {
      const vars = {
        bookingId: payload.bookingId,
        rentalItemName: payload.rentalItemName,
        endAt: payload.endAt,
      };
      const [cu, bu] = await Promise.all([
        this.getUserRowForEmail(payload.clientUserId),
        this.getUserRowForEmail(payload.businessUserId),
      ]);
      if (!cu?.email || !bu?.email) {
        this.logger.warn('Rental period ended email skipped: missing email');
        return;
      }
      const clientLocale = normalizeLanguage(cu.preferred_language);
      const businessLocale = normalizeLanguage(bu.preferred_language);
      await this.sendEmail({
        to: bu.email,
        templateKey: this.mapKeyForLanguage(
          'business_rental_period_ended',
          businessLocale
        ),
        variables: vars,
      });
      await this.sendEmail({
        to: cu.email,
        templateKey: this.mapKeyForLanguage(
          'client_rental_period_ended',
          clientLocale
        ),
        variables: vars,
      });
    } catch (error: any) {
      this.logger.error(
        `sendRentalPeriodEndedEmails: ${error?.message ?? String(error)}`
      );
    }
  }

  async sendRentalListingApprovedEmail(
    payload: RentalListingModerationEmailPayload
  ): Promise<void> {
    try {
      const u = await this.getUserRowForEmail(payload.businessUserId);
      if (!u?.email) {
        this.logger.warn(
          'Rental listing approved email skipped: missing recipient email'
        );
        return;
      }
      const locale = normalizeLanguage(u.preferred_language);
      await this.sendEmail({
        to: u.email,
        templateKey: this.mapKeyForLanguage(
          'business_rental_listing_approved',
          locale
        ),
        variables: {
          listingId: payload.listingId,
          rentalItemName: payload.rentalItemName,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `sendRentalListingApprovedEmail: ${error?.message ?? String(error)}`
      );
    }
  }

  async sendRentalListingRejectedEmail(
    payload: RentalListingRejectedEmailPayload
  ): Promise<void> {
    try {
      const u = await this.getUserRowForEmail(payload.businessUserId);
      if (!u?.email) {
        this.logger.warn(
          'Rental listing rejected email skipped: missing recipient email'
        );
        return;
      }
      const locale = normalizeLanguage(u.preferred_language);
      await this.sendEmail({
        to: u.email,
        templateKey: this.mapKeyForLanguage(
          'business_rental_listing_rejected',
          locale
        ),
        variables: {
          listingId: payload.listingId,
          rentalItemName: payload.rentalItemName,
          rejectionReason: payload.rejectionReason,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `sendRentalListingRejectedEmail: ${error?.message ?? String(error)}`
      );
    }
  }

  async sendBusinessRentalBookingRequestEmail(
    payload: BusinessRentalBookingRequestEmailPayload
  ): Promise<void> {
    try {
      const u = await this.getUserRowForEmail(payload.businessUserId);
      if (!u?.email) {
        this.logger.warn(
          'Rental booking request email skipped: missing business email'
        );
        return;
      }
      const locale = normalizeLanguage(u.preferred_language);
      await this.sendEmail({
        to: u.email,
        templateKey: this.mapKeyForLanguage(
          'business_rental_booking_request',
          locale
        ),
        variables: {
          requestId: payload.requestId,
          listingId: payload.listingId,
          rentalItemName: payload.rentalItemName,
          locationName: payload.locationName,
          requestedStartAt: payload.requestedStartAt,
          requestedEndAt: payload.requestedEndAt,
          clientName: payload.clientName,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `sendBusinessRentalBookingRequestEmail: ${error?.message ?? String(error)}`
      );
    }
  }

  async sendClientRentalRequestAcceptedEmail(
    payload: ClientRentalRequestAcceptedEmailPayload
  ): Promise<void> {
    try {
      const u = await this.getUserRowForEmail(payload.clientUserId);
      if (!u?.email) {
        this.logger.warn(
          'Rental request accepted email skipped: missing client email'
        );
        return;
      }
      const locale = normalizeLanguage(u.preferred_language);
      await this.sendEmail({
        to: u.email,
        templateKey: this.mapKeyForLanguage(
          'client_rental_request_accepted',
          locale
        ),
        variables: {
          requestId: payload.requestId,
          rentalItemName: payload.rentalItemName,
          businessName: payload.businessName,
          bookingNumber: payload.bookingNumber,
          contractExpiresAt: payload.contractExpiresAt,
          requestedStartAt: payload.requestedStartAt,
          requestedEndAt: payload.requestedEndAt,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `sendClientRentalRequestAcceptedEmail: ${error?.message ?? String(error)}`
      );
    }
  }

  async sendClientRentalRequestRejectedEmail(
    payload: ClientRentalRequestRejectedEmailPayload
  ): Promise<void> {
    try {
      const u = await this.getUserRowForEmail(payload.clientUserId);
      if (!u?.email) {
        this.logger.warn(
          'Rental request rejected email skipped: missing client email'
        );
        return;
      }
      const locale = normalizeLanguage(u.preferred_language);
      const reasonHtml = clientRentalRejectionReasonHtml(
        payload.unavailableReasonCode,
        payload.businessResponseNote,
        locale
      );
      await this.sendEmail({
        to: u.email,
        templateKey: this.mapKeyForLanguage(
          'client_rental_request_rejected',
          locale
        ),
        variables: {
          requestId: payload.requestId,
          rentalItemName: payload.rentalItemName,
          businessName: payload.businessName,
          reasonHtml,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `sendClientRentalRequestRejectedEmail: ${error?.message ?? String(error)}`
      );
    }
  }

  private async getUserRowForEmail(userId: string): Promise<{
    email: string;
    preferred_language?: string;
  } | null> {
    const q = `query U($id: uuid!) { users_by_pk(id: $id) { email preferred_language } }`;
    const r = await this.hasuraSystemService.executeQuery<{ users_by_pk: any }>(
      q,
      { id: userId }
    );
    return r.users_by_pk ?? null;
  }

  /**
   * Send order status change notifications
   */
  async sendOrderStatusChangeNotifications(
    data: NotificationData,
    previousStatus: string
  ): Promise<void> {
    try {
      const templateKey = this.getTemplateKey(data.orderStatus);
      const recipients = this.getRecipientsForStatus(data.orderStatus, data);

      for (const recipient of recipients) {
        const baseKey = `${recipient.type}_${templateKey}`;
        const locale = this.languageForRecipient(data, recipient.type);
        const mapKey = this.mapKeyForLanguage(baseKey, locale);
        if (!this.resendTemplateIds[mapKey]) continue;
        const itemsVariant =
          templateKey === 'order_assigned' ? 'agentAssigned' : 'default';
        try {
          await this.sendEmail({
            to: recipient.email,
            templateKey: mapKey,
            variables: buildResendTemplateVariables(
              data,
              recipient.type,
              locale,
              { orderItemsVariant: itemsVariant }
            ),
          });
        } catch (error: unknown) {
          this.logger.warn(
            `Failed to send order status email to ${recipient.email}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Send push notifications for key statuses
      await this.sendPushForOrderStatus(data);
      // Send SMS for critical statuses when enabled
      await this.sendSmsForOrderStatus(data);

      this.logger.log(
        `Order status change notifications sent for order ${data.orderNumber} (${previousStatus} → ${data.orderStatus})`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send order status change notifications: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Send push notifications for every order status change using webPush.sendNotification.
   * Recipients are determined by getRecipientsForStatus; each gets a status-appropriate message.
   */
  private async sendPushForOrderStatus(data: NotificationData): Promise<void> {
    const pushConfig = this.configService.get<Configuration['push']>('push');
    if (!pushConfig?.enabled) return;

    const status = data.orderStatus;
    const { title, body } = this.getPushMessageForOrderStatus(
      status,
      data.orderNumber
    );
    if (!title || !body) return;

    const pushPayload = {
      url: `/orders/${data.orderId}`,
      orderId: data.orderId,
      orderNumber: data.orderNumber,
    };

    try {
      const recipients = this.getRecipientsForStatus(status, data);
      for (const recipient of recipients) {
        if (recipient.email) {
          await this.sendPushNotificationByEmail(
            recipient.email,
            title,
            body,
            pushPayload
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Push notification failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Get title and body for push notification by order status.
   */
  private getPushMessageForOrderStatus(
    status: string,
    orderNumber: string
  ): { title: string; body: string } {
    const messages: Record<
      string,
      { title: string; body: string }
    > = {
      pending: {
        title: 'Order received',
        body: `Order ${orderNumber} has been received and is being processed.`,
      },
      confirmed: {
        title: 'Order confirmed',
        body: `Order ${orderNumber} has been confirmed.`,
      },
      preparing: {
        title: 'Order preparing',
        body: `Order ${orderNumber} is being prepared.`,
      },
      ready_for_pickup: {
        title: 'Ready for pickup',
        body: `Order ${orderNumber} is ready for pickup.`,
      },
      assigned_to_agent: {
        title: 'New delivery assigned',
        body: `Order ${orderNumber} has been assigned to you.`,
      },
      picked_up: {
        title: 'Order picked up',
        body: `Order ${orderNumber} has been picked up.`,
      },
      in_transit: {
        title: 'Order in transit',
        body: `Order ${orderNumber} is on the way.`,
      },
      out_for_delivery: {
        title: 'Order out for delivery',
        body: `Order ${orderNumber} is on its way.`,
      },
      delivered: {
        title: 'Order delivered',
        body: `Order ${orderNumber} has been delivered.`,
      },
      complete: {
        title: 'Order complete',
        body: `Order ${orderNumber} is complete.`,
      },
      cancelled: {
        title: 'Order cancelled',
        body: `Order ${orderNumber} has been cancelled.`,
      },
      failed: {
        title: 'Order failed',
        body: `Order ${orderNumber} has failed.`,
      },
      refunded: {
        title: 'Order refunded',
        body: `Order ${orderNumber} has been refunded.`,
      },
    };
    return (
      messages[status] || {
        title: 'Order status updated',
        body: `Order ${orderNumber} status has been updated.`,
      }
    );
  }

  /**
   * Get VAPID public key for client push subscription (no auth required)
   */
  getVapidPublicKey(): { publicKey: string } {
    const pushConfig = this.configService.get<Configuration['push']>('push');
    return {
      publicKey: pushConfig?.vapidPublicKey ?? '',
    };
  }

  /**
   * Initialize web-push with VAPID keys
   */
  private initializeWebPush(): void {
    const pushConfig = this.configService.get<Configuration['push']>('push');
    if (!pushConfig?.vapidPublicKey || !pushConfig?.vapidPrivateKey) return;
    try {
      webPush.setVapidDetails(
        'mailto:noreply@rendasua.com',
        pushConfig.vapidPublicKey,
        pushConfig.vapidPrivateKey
      );
    } catch (e) {
      this.logger.warn('Failed to set VAPID details for web-push', e);
    }
  }

  /**
   * Get or create Expo SDK client (lazy init with optional access token)
   */
  private getExpoClient(): Expo | null {
    if (this.expoClient) return this.expoClient;
    const pushConfig = this.configService.get<Configuration['push']>('push');
    if (!pushConfig?.enabled) return null;
    try {
      this.expoClient = new Expo({
        accessToken: pushConfig.expoAccessToken,
      });
      return this.expoClient;
    } catch (e) {
      this.logger.warn('Failed to create Expo client', e);
      return null;
    }
  }

  /**
   * Send push to all Expo tokens for a user (by user id)
   */
  private async sendPushToExpoTokens(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const expo = this.getExpoClient();
    if (!expo) return;
    const tokenQuery = `
      query GetMobilePushTokens($userId: uuid!) {
        mobile_push_tokens(where: { user_id: { _eq: $userId } }) {
          expo_push_token
        }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(
        tokenQuery,
        { userId }
      );
      const rows = (result?.mobile_push_tokens as Array<{ expo_push_token: string }>) ?? [];
      const validTokens = rows
        .map((r) => r.expo_push_token)
        .filter((t) => Expo.isExpoPushToken(t));
      if (validTokens.length === 0) return;
      const messages = validTokens.map((token) => ({
        to: token,
        title,
        body,
        data: data ?? {},
      }));
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (sendErr) {
          this.logger.warn(
            `Expo push chunk failed: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `sendPushToExpoTokens failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Save push subscription for a user (by DB user id / JWT x-hasura-user-id)
   */
  async savePushSubscription(
    userId: string,
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const check = await this.hasuraSystemService.executeQuery<{
        users_by_pk: { id: string } | null;
      }>(`query U($id: uuid!) { users_by_pk(id: $id) { id } }`, {
        id: userId,
      });
      if (!check.users_by_pk) {
        return { success: false, error: 'User not found' };
      }

      const mutation = `
        mutation InsertPushSubscription($object: push_subscriptions_insert_input!) {
          insert_push_subscriptions_one(object: $object) {
            id
          }
        }
      `;
      await this.hasuraSystemService.executeMutation(mutation, {
        object: {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
        },
      });
      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to save push subscription', err);
      return {
        success: false,
        error: err?.message ?? 'Failed to save subscription',
      };
    }
  }

  /**
   * Save Expo push token for the current user (by DB user id).
   */
  async saveMobilePushToken(
    userId: string,
    expoPushToken: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!expoPushToken?.trim()) {
      return { success: false, error: 'Expo push token is required' };
    }
    if (!Expo.isExpoPushToken(expoPushToken)) {
      return { success: false, error: 'Invalid Expo push token' };
    }
    try {
      const check = await this.hasuraSystemService.executeQuery<{
        users_by_pk: { id: string } | null;
      }>(`query U($id: uuid!) { users_by_pk(id: $id) { id } }`, { id: userId });
      if (!check.users_by_pk) {
        return { success: false, error: 'User not found' };
      }
      const mutation = `
        mutation InsertMobilePushToken($object: mobile_push_tokens_insert_input!) {
          insert_mobile_push_tokens_one(object: $object) {
            id
          }
        }
      `;
      await this.hasuraSystemService.executeMutation(mutation, {
        object: {
          user_id: userId,
          expo_push_token: expoPushToken.trim(),
        },
      });
      return { success: true };
    } catch (err: any) {
      if (err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
        return { success: true };
      }
      this.logger.error('Failed to save mobile push token', err);
      return {
        success: false,
        error: err?.message ?? 'Failed to save token',
      };
    }
  }

  /**
   * Send a test push notification to web and/or mobile subscriptions for the current user.
   */
  async sendTestPushNotification(
    userId: string,
    title?: string,
    body?: string
  ): Promise<{ sent: boolean; subscriptionsCount: number; sentCount?: number; error?: string }> {
    const pushConfig = this.configService.get<Configuration['push']>('push');
    if (!pushConfig) {
      return {
        sent: false,
        subscriptionsCount: 0,
        error: 'Push config not available',
      };
    }
    if (!pushConfig.enabled) {
      return {
        sent: false,
        subscriptionsCount: 0,
        error: 'Push notifications are disabled (PUSH_NOTIFICATIONS_ENABLED is not true)',
      };
    }

    try {
      const check = await this.hasuraSystemService.executeQuery<{
        users_by_pk: { id: string } | null;
      }>(`query U($id: uuid!) { users_by_pk(id: $id) { id } }`, { id: userId });
      if (!check.users_by_pk) {
        return { sent: false, subscriptionsCount: 0, error: 'User not found' };
      }

      const [subResult, tokenResult] = await Promise.all([
        this.hasuraSystemService.executeQuery(
          `query GetPushSubscriptions($userId: uuid!) {
            push_subscriptions(where: { user_id: { _eq: $userId } }) {
              id endpoint p256dh_key auth_key
            }
          }`,
          { userId }
        ),
        this.hasuraSystemService.executeQuery(
          `query GetMobilePushTokens($userId: uuid!) {
            mobile_push_tokens(where: { user_id: { _eq: $userId } }) {
              expo_push_token
            }
          }`,
          { userId }
        ),
      ]);

      const subs = (subResult?.push_subscriptions as Array<{
        id: string;
        endpoint: string;
        p256dh_key: string;
        auth_key: string;
      }>) ?? [];
      const tokenRows = (tokenResult?.mobile_push_tokens as Array<{ expo_push_token: string }>) ?? [];
      const mobileTokens = tokenRows
        .map((r) => r.expo_push_token)
        .filter((t) => Expo.isExpoPushToken(t));
      const totalSubs = subs.length + mobileTokens.length;

      if (totalSubs === 0) {
        return {
          sent: false,
          subscriptionsCount: 0,
          error: 'No push subscriptions for this user. Subscribe from the app or register a push token first.',
        };
      }

      const payloadTitle = title ?? 'Test notification';
      const payloadBody = body ?? 'This is a test push from Rendasua.';
      const payloadData = {
        type: 'test',
        orderId: `test-${Date.now()}`,
      };
      let webSent = 0;
      let mobileSent = 0;

      if (subs.length > 0 && pushConfig.vapidPublicKey && pushConfig.vapidPrivateKey) {
        this.initializeWebPush();
        const payload = JSON.stringify({
          title: payloadTitle,
          body: payloadBody,
          ...payloadData,
        });
        for (const sub of subs) {
          try {
            await webPush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
              },
              payload,
              { TTL: 86400 }
            );
            webSent += 1;
          } catch (sendErr) {
            this.logger.warn(
              `Test push failed for subscription ${sub.endpoint}: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`
            );
          }
        }
      }

      if (mobileTokens.length > 0) {
        const expo = this.getExpoClient();
        if (expo) {
          const messages = mobileTokens.map((token) => ({
            to: token,
            title: payloadTitle,
            body: payloadBody,
            data: payloadData,
          }));
          const chunks = expo.chunkPushNotifications(messages);
          for (const chunk of chunks) {
            try {
              await expo.sendPushNotificationsAsync(chunk);
              mobileSent += chunk.length;
            } catch (sendErr) {
              this.logger.warn(
                `Test Expo push failed: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`
              );
            }
          }
        }
      }

      const sentCount = webSent + mobileSent;
      return {
        sent: sentCount > 0,
        subscriptionsCount: totalSubs,
        sentCount,
        ...(sentCount < totalSubs && {
          error: `Sent to ${sentCount}/${totalSubs} subscription(s); some may have expired.`,
        }),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sendTestPushNotification failed: ${message}`);
      return {
        sent: false,
        subscriptionsCount: 0,
        error: message,
      };
    }
  }

  /**
   * Send push notification to all subscriptions for a user (lookup by email).
   * Sends to web push subscriptions (if VAPID configured) and to Expo mobile tokens when available.
   */
  private async sendPushNotificationByEmail(
    email: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const pushConfig = this.configService.get<Configuration['push']>('push');
    if (!pushConfig?.enabled) return;

    try {
      const userQuery = `
        query GetUserByEmail($email: String!) {
          users(where: { email: { _eq: $email } }, limit: 1) {
            id
          }
        }
      `;
      const userResult = await this.hasuraSystemService.executeQuery(
        userQuery,
        { email }
      );
      const users = (userResult?.users as { id: string }[]) ?? [];
      if (users.length === 0) return;
      const userId = users[0].id;

      if (pushConfig.vapidPrivateKey) {
        this.initializeWebPush();
        const subQuery = `
          query GetPushSubscriptions($userId: uuid!) {
            push_subscriptions(where: { user_id: { _eq: $userId } }) {
              id
              endpoint
              p256dh_key
              auth_key
            }
          }
        `;
        const subResult = await this.hasuraSystemService.executeQuery(
          subQuery,
          { userId }
        );
        const subs = (subResult?.push_subscriptions as Array<{
          endpoint: string;
          p256dh_key: string;
          auth_key: string;
        }>) ?? [];
        const payload = JSON.stringify({ title, body, ...data });
        for (const sub of subs) {
          try {
            await webPush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh_key,
                  auth: sub.auth_key,
                },
              },
              payload,
              { TTL: 86400 }
            );
          } catch (sendErr) {
            this.logger.warn(
              `Push send failed for subscription ${sub.endpoint}: ${sendErr}`
            );
          }
        }
      }

      await this.sendPushToExpoTokens(userId, title, body, data);
    } catch (err) {
      this.logger.warn(
        `sendPushNotificationByEmail failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Send email using Resend transactional template
   */
  /**
   * Resend validates each variable against the template's declared types in the
   * dashboard (e.g. money fields are often `string`). Coerce numbers to strings.
   */
  private serializeResendVariables(
    variables: Record<string, string | number | boolean | null | undefined>
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (value === undefined) continue;
      if (value === null) {
        out[key] = '';
        continue;
      }
      if (typeof value === 'boolean') {
        out[key] = value ? 'true' : 'false';
        continue;
      }
      if (typeof value === 'number') {
        out[key] = String(value);
        continue;
      }
      out[key] = value;
    }
    return out;
  }

  private async sendEmail(params: {
    to: string;
    templateKey: string;
    variables: Record<string, string | number | boolean | null | undefined>;
  }): Promise<void> {
    this.initializeResend();
    if (!this.resendClient) {
      this.logger.warn('Resend not configured, skipping email send');
      return;
    }
    const { to, templateKey, variables } = params;
    if (!to) throw new Error('Recipient email address is required');
    const templateId = this.resendTemplateIds[templateKey]?.trim();
    if (!templateId) {
      this.logger.warn(
        `No Resend template id for key "${templateKey}" — run npm run sync:resend-templates`
      );
      return;
    }
    const templateVariables = this.serializeResendVariables(variables);
    try {
      const { error } = await this.resendClient.emails.send({
        from: this.fromEmail,
        to: [to],
        template: {
          id: templateId,
          variables: templateVariables as Record<string, string | number>,
        },
      });
      if (error) {
        throw new Error(JSON.stringify(error));
      }
      this.logger.log(`Email sent to ${to} (template ${templateKey})`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send email to ${to}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Get template key for order status
   */
  private getTemplateKey(status: string): string {
    const statusMap: Record<string, string> = {
      confirmed: 'order_confirmed',
      preparing: 'order_preparing',
      ready_for_pickup: 'order_ready_for_pickup',
      assigned_to_agent: 'order_assigned',
      picked_up: 'order_picked_up',
      in_transit: 'order_in_transit',
      out_for_delivery: 'order_out_for_delivery',
      delivered: 'order_delivered',
      cancelled: 'order_cancelled',
      failed: 'order_failed',
      refunded: 'order_refunded',
    };

    return statusMap[status] || 'order_status_change';
  }

  /**
   * Get recipients for specific order status
   */
  private getRecipientsForStatus(
    status: string,
    data: NotificationData
  ): Array<{
    email: string;
    type: string;
  }> {
    const recipients = [];

    switch (status) {
      case 'pending':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        break;
      case 'confirmed':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        break;
      case 'preparing':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        break;
      case 'ready_for_pickup':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        break;
      case 'assigned_to_agent':
        if (data.agentEmail) {
          recipients.push({ email: data.agentEmail, type: 'agent' });
        }
        break;
      case 'picked_up':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        if (data.agentEmail) {
          recipients.push({ email: data.agentEmail, type: 'agent' });
        }
        break;
      case 'in_transit':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        if (data.agentEmail) {
          recipients.push({ email: data.agentEmail, type: 'agent' });
        }
        break;
      case 'out_for_delivery':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        if (data.agentEmail) {
          recipients.push({ email: data.agentEmail, type: 'agent' });
        }
        break;
      case 'delivered':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        if (data.agentEmail) {
          recipients.push({ email: data.agentEmail, type: 'agent' });
        }
        break;
      case 'cancelled':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        if (data.agentEmail) {
          recipients.push({ email: data.agentEmail, type: 'agent' });
        }
        break;
      case 'failed':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        if (data.agentEmail) {
          recipients.push({ email: data.agentEmail, type: 'agent' });
        }
        break;
      case 'refunded':
        recipients.push(
          { email: data.clientEmail, type: 'client' },
          { email: data.businessEmail, type: 'business' }
        );
        break;
    }

    return recipients;
  }

  /**
   * Send SMS for critical order statuses (when SMS enabled)
   */
  private async sendSmsForOrderStatus(data: NotificationData): Promise<void> {
    const smsConfig = this.configService.get<Configuration['sms']>('sms');
    if (!smsConfig?.enabled || !smsConfig.twilioAccountSid || !smsConfig.twilioAuthToken) return;

    const status = data.orderStatus;
    let email: string | undefined;
    let body: string;

    switch (status) {
      case 'confirmed':
        email = data.clientEmail;
        body = `Rendasua: Your order ${data.orderNumber} has been confirmed.`;
        break;
      case 'assigned_to_agent':
        email = data.agentEmail;
        body = `Rendasua: Order ${data.orderNumber} has been assigned to you.`;
        break;
      case 'out_for_delivery':
        email = data.clientEmail;
        body = `Rendasua: Order ${data.orderNumber} is out for delivery.`;
        break;
      case 'delivered':
        email = data.clientEmail;
        body = `Rendasua: Order ${data.orderNumber} has been delivered. Thank you!`;
        break;
      default:
        return;
    }

    if (!email) return;

    try {
      const userQuery = `
        query GetUserPhoneByEmail($email: String!) {
          users(where: { email: { _eq: $email } }, limit: 1) {
            phone_number
          }
        }
      `;
      const userResult = await this.hasuraSystemService.executeQuery(userQuery, { email });
      const users = (userResult?.users as { phone_number?: string | null }[]) ?? [];
      if (users.length === 0 || !users[0].phone_number) return;

      const to = users[0].phone_number.trim();
      if (!to) return;

      await this.sendSms(to, body);
    } catch (err) {
      this.logger.warn(
        `SMS for order status failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendSms(to: string, body: string): Promise<void> {
    const smsConfig = this.configService.get<Configuration['sms']>('sms');
    if (!smsConfig?.twilioAccountSid || !smsConfig?.twilioAuthToken || !smsConfig?.twilioPhoneNumber) return;

    try {
      const client = twilio(smsConfig.twilioAccountSid, smsConfig.twilioAuthToken);
      await client.messages.create({
        body,
        from: smsConfig.twilioPhoneNumber,
        to: to.startsWith('+') ? to : `+${to}`,
      });
      this.logger.log(`SMS sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${to}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  /**
   * Send proximity order notification to agent
   */
  async sendProximityOrderNotification(
    agentEmail: string,
    agentName: string,
    orderData: {
      orderId: string;
      orderNumber: string;
      businessName: string;
      businessAddress: string;
    },
    preferredLanguage?: string
  ): Promise<void> {
    try {
      if (!agentEmail) {
        this.logger.warn('Agent email is required for proximity notification');
        return;
      }

      const locale = normalizeLanguage(preferredLanguage);
      const msg =
        locale === 'fr'
          ? `Une nouvelle commande (${orderData.orderNumber}) a été passée chez ${orderData.businessName}, situé à ${orderData.businessAddress}. Vous êtes à moins de 10 km de ce lieu.`
          : `A new order (${orderData.orderNumber}) has been placed at ${orderData.businessName}, located at ${orderData.businessAddress}. You are within 10km of this location.`;
      const variables = buildProximityVariables(agentName, orderData, msg);
      await this.sendEmail({
        to: agentEmail,
        templateKey: this.mapKeyForLanguage('agent_order_proximity', locale),
        variables,
      });

      this.logger.log(
        `Proximity notification sent to agent ${agentEmail} for order ${orderData.orderNumber}`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send proximity notification to ${agentEmail}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Don't throw - this runs in background
    }
  }
}
