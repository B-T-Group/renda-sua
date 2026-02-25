import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@sendgrid/mail';
import * as webPush from 'web-push';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import twilio = require('twilio');

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
}

export interface NotificationData {
  orderId: string;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  businessEmail: string;
  businessVerified?: boolean;
  agentName?: string;
  agentEmail?: string;
  orderStatus: string;
  orderItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  fastDeliveryFee?: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  deliveryAddress: string;
  estimatedDeliveryTime?: string;
  specialInstructions?: string;
  notes?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private sendGridApiKey: string;
  private fromEmail: string;
  private sendGridClient!: MailService;

  // Email template IDs - SendGrid dynamic templates
  private readonly templateIds: Record<string, string> = {
    agent_order_assigned: 'd-677d5e37531e4fdb91a2dc2397b3472d',
    business_order_confirmed: 'd-33003fcfd6044bbea24e0f216eeb9453',
    business_order_created: 'd-319798ddef494864ab42b3dfa9ec5851',
    client_order_cancelled: 'd-846435f17c0642ad83a21b6a0fc0b7ef',
    client_order_confirmed: 'd-ac1c9fb7d3f24fb09a926aa9e18d0c5b',
    client_order_created: 'd-bdc9418727e745e79e08d379d2cccc13',
    client_order_delivered: 'd-41ece35d4d964974bc9bdd017712ae93',
    client_order_in_transit: 'd-30e1c53d84694677a74a4ffc157af7e5',
    client_order_out_for_delivery: 'd-b92e834621e941a983e37f0d8b50d602',
    client_order_preparing: 'd-930c89603bef4245b23f814ab9dfa8f0',
    business_order_preparing: 'd-b8f546da83d242a2b1cbd87609894009',
    client_order_ready_for_pickup: 'd-fc0c078abc9e4dbcbbad9e6650687e01',
    business_order_ready_for_pickup: 'd-e341f1ad044a4a1a9181903df1b157e1',
    client_order_picked_up: 'd-1eedccd060f14547ba914c4d555f6ace',
    business_order_picked_up: 'd-806443e0b9da4b7385f0a938e2f48edc',
    agent_order_picked_up: 'd-3e6326019a344810b2c6492dbc4fe799',
    business_order_in_transit: 'd-43c3f3e463084224a74f9d119107c9d4',
    agent_order_in_transit: 'd-a62a3021e6274eb1ae87d8646f52e9f0',
    business_order_out_for_delivery: 'd-3a943739c7b241cab8f28c540949c05e',
    agent_order_out_for_delivery: 'd-2cbd1b9da4dc430f95f65e5317f2260f',
    business_order_delivered: 'd-cffea2b5771c4e11900da69a21c1b85c',
    agent_order_delivered: 'd-d801120f7ca844b0a387a1d368e9fe4c',
    business_order_cancelled: 'd-921ac77cd8d649d3a071036e07c07620',
    agent_order_cancelled: 'd-2604899cec63489d99fafadbf16d153c',
    client_order_failed: 'd-4a12ce0b35344b0593d2c6de1eb3902c',
    business_order_failed: 'd-fa4393011d8e4e8d935324edbeeba3d9',
    agent_order_failed: 'd-68153e361f014e0da4652bb74b152257',
    client_order_refunded: 'd-cd58073a8cdf48ce9ca9552b96d67a28',
    business_order_refunded: 'd-4605e867a50f465ca7ecfc214d73a3d3',
    agent_order_proximity: 'd-aa49da3f30f449dd9b273731bc2a9917',
    agent_order_assigned_fr: 'd-d3946f1f2d4242d6ae38606db4acdf55',
    agent_order_cancelled_fr: 'd-f4c2934d86ac4b0181b0ab20837714ce',
    agent_order_delivered_fr: 'd-cf3aeba42174432687fab4139ec0dc4a',
    agent_order_failed_fr: 'd-f03b6206f5df4ad5865742fb51638edb',
    agent_order_in_transit_fr: 'd-f5fee02a17344457a2656cdcf0626592',
    agent_order_out_for_delivery_fr: 'd-26ecf9deb6cc4f14b53cd5cef7841ea9',
    agent_order_picked_up_fr: 'd-30ef4874230a4e0a8ad7ee2acfd3908b',
    agent_order_proximity_fr: 'd-3c3d59c19cfa4da2b8d1e072f416a06a',
    business_order_cancelled_fr: 'd-cd12b86e97eb4d57b8d0e1112e55149a',
    business_order_confirmed_fr: 'd-ac4b6140ac2c464a8690761f43d83665',
    business_order_created_fr: 'd-5e38f2b33e024a5bb1cc2bb028bb2761',
    business_order_delivered_fr: 'd-c4b262cf01194ffba1af9a70b82b329e',
    business_order_failed_fr: 'd-ac802f8783b24ac0a1f2acb89ac12470',
    business_order_in_transit_fr: 'd-b98aec5074754bec9b4b7231671c6b35',
    business_order_out_for_delivery_fr: 'd-2b30913bb7f549c3a9b12c41218eb892',
    business_order_picked_up_fr: 'd-1e21c33a51e044c981e89f32adab2aa8',
    business_order_preparing_fr: 'd-a909a7eb12d24240807decf5e846f107',
    business_order_ready_for_pickup_fr: 'd-bedccf9fed4341e893e6089f27564c83',
    business_order_refunded_fr: 'd-27db37d559ba4ee284a09aa7721239c3',
    client_order_cancelled_fr: 'd-9daf143cf57c4976bc9ab294305e4ee1',
    client_order_confirmed_fr: 'd-21121bef163a4335a79c443d718e1d59',
    client_order_created_fr: 'd-b0288d89c24946c48d102d33b6b9dcff',
    client_order_delivered_fr: 'd-8e410586080040cc8ffaf280c5614866',
    client_order_failed_fr: 'd-48125a9324bb41ac85bbf626948c79de',
    client_order_in_transit_fr: 'd-41fa65f69bd8452bbf32ba9ec276ea20',
    client_order_out_for_delivery_fr: 'd-244cd5ddbc834857a659f8430eb8f679',
    client_order_picked_up_fr: 'd-cccaa3ce1d5442e0b2309fd862a0fef3',
    client_order_preparing_fr: 'd-b96df93d7e12445cb8a4a84557540357',
    client_order_ready_for_pickup_fr: 'd-3a94a315697d44af8cde4accf6e80ea3',
    client_order_refunded_fr: 'd-d8d0f3f06e944e619193b5ebce213baf',
  };

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly hasuraSystemService: HasuraSystemService
  ) {
    // Initialize with empty values - will be set when first used
    this.sendGridApiKey = '';
    this.fromEmail = 'noreply@rendasua.com';
  }

  private initializeSendGrid(): void {
    if (this.sendGridClient) {
      return; // Already initialized
    }

    const emailConfig = this.configService.get('email');
    console.log('emailConfig', emailConfig);
    this.sendGridApiKey = emailConfig?.sendGridApiKey || '';
    this.fromEmail = emailConfig?.sendGridFromEmail || 'noreply@rendasua.com';

    if (this.sendGridApiKey) {
      try {
        this.sendGridClient = new MailService();
        this.sendGridClient.setApiKey(this.sendGridApiKey);
        this.logger.log('SendGrid API key initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize SendGrid API key:', error);
      }
    } else {
      this.logger.warn(
        'SendGrid API key not available - email notifications will be disabled'
      );
    }
  }

  /**
   * Send order creation notifications
   */
  async sendOrderCreatedNotifications(data: NotificationData): Promise<void> {
    try {
      // Notify client
      await this.sendEmail({
        to: data.clientEmail,
        templateId: this.templateIds.client_order_created,
        dynamicTemplateData: this.prepareTemplateData(data, 'client'),
      });

      // Notify business
      await this.sendEmail({
        to: data.businessEmail,
        templateId: this.templateIds.business_order_created,
        dynamicTemplateData: this.prepareTemplateData(data, 'business'),
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
        const recipientTemplate = `${recipient.type}_${templateKey}`;
        if (this.templateIds[recipientTemplate]) {
          try {
            await this.sendEmail({
              to: recipient.email,
              templateId: this.templateIds[recipientTemplate],
              dynamicTemplateData: this.prepareTemplateData(
                data,
                recipient.type
              ),
            });
          } catch (error: unknown) {
            this.logger.warn(
              `Failed to send order status email to ${recipient.email}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
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
    if (!pushConfig?.enabled || !pushConfig.vapidPrivateKey) return;

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
   * Save push subscription for a user (by Auth0 identifier)
   */
  async savePushSubscription(
    userIdentifier: string,
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const query = `
        query GetUserByIdentifier($identifier: String!) {
          users(where: { identifier: { _eq: $identifier } }, limit: 1) {
            id
          }
        }
      `;
      const result = await this.hasuraSystemService.executeQuery(query, {
        identifier: userIdentifier,
      });
      const users = (result?.users as { id: string }[]) ?? [];
      if (users.length === 0) {
        return { success: false, error: 'User not found' };
      }
      const userId = users[0].id;

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
   * Send a test push notification using the same VAPID config and stored push subscriptions.
   * Explicitly uses ConfigService push config and push_subscriptions from the DB.
   */
  async sendTestPushNotification(
    userIdentifier: string,
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
    if (!pushConfig.vapidPublicKey || !pushConfig.vapidPrivateKey) {
      return {
        sent: false,
        subscriptionsCount: 0,
        error: 'VAPID keys not configured (set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env)',
      };
    }

    this.initializeWebPush();

    try {
      const userQuery = `
        query GetUserByIdentifier($identifier: String!) {
          users(where: { identifier: { _eq: $identifier } }, limit: 1) {
            id
          }
        }
      `;
      const userResult = await this.hasuraSystemService.executeQuery(
        userQuery,
        { identifier: userIdentifier }
      );
      const users = (userResult?.users as { id: string }[]) ?? [];
      if (users.length === 0) {
        return { sent: false, subscriptionsCount: 0, error: 'User not found' };
      }
      const userId = users[0].id;

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
        id: string;
        endpoint: string;
        p256dh_key: string;
        auth_key: string;
      }>) ?? [];

      if (subs.length === 0) {
        return {
          sent: false,
          subscriptionsCount: 0,
          error: 'No push subscriptions for this user. Subscribe from the app first.',
        };
      }

      const payload = JSON.stringify({
        title: title ?? 'Test notification',
        body: body ?? 'This is a test push from Rendasua.',
        type: 'test',
        orderId: `test-${Date.now()}`,
      });

      let sentCount = 0;
      for (const sub of subs) {
        try {
          const result = await webPush.sendNotification(
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
          console.log('result', result);
          sentCount += 1;
        } catch (sendErr) {
          this.logger.warn(
            `Test push failed for subscription ${sub.endpoint}: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`
          );
        }
      }

      return {
        sent: sentCount > 0,
        subscriptionsCount: subs.length,
        sentCount,
        ...(sentCount < subs.length && {
          error: `Sent to ${sentCount}/${subs.length} subscription(s); some may have expired.`,
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
   * Send push notification to all subscriptions for a user (lookup by email)
   */
  private async sendPushNotificationByEmail(
    email: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const pushConfig = this.configService.get<Configuration['push']>('push');
    if (!pushConfig?.enabled || !pushConfig.vapidPrivateKey) return;

    this.initializeWebPush();

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

      const payload = JSON.stringify({
        title,
        body,
        ...data,
      });

      for (const sub of subs) {
        try {
          const result = await webPush.sendNotification(
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
          console.log('result', result);
        } catch (sendErr) {
          this.logger.warn(
            `Push send failed for subscription ${sub.endpoint}: ${sendErr}`
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `sendPushNotificationByEmail failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Send email using SendGrid
   */
  private async sendEmail({
    to,
    templateId,
    dynamicTemplateData,
  }: {
    to: string;
    templateId: string;
    dynamicTemplateData: any;
  }): Promise<void> {
    // Initialize SendGrid if not already done
    this.initializeSendGrid();

    if (!this.sendGridClient) {
      this.logger.warn('SendGrid client not configured, skipping email send');
      return;
    }

    if (!to) {
      throw new Error('Recipient email address is required');
    }

    if (!templateId) {
      throw new Error('Template ID is required');
    }

    if (!dynamicTemplateData) {
      throw new Error('Template data is required');
    }

    const msg = {
      to,
      from: this.fromEmail,
      templateId,
      dynamicTemplateData,
    };

    try {
      await this.sendGridClient.send(msg);
      this.logger.log(`Email sent to ${to} using template ${templateId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Escape special characters for Handlebars templates
   */
  private escapeHandlebarsContent(content: any): any {
    if (typeof content === 'string') {
      // Escape HTML entities and special characters
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    if (Array.isArray(content)) {
      return content.map((item) => this.escapeHandlebarsContent(item));
    }
    if (content && typeof content === 'object') {
      const escaped: any = {};
      for (const [key, value] of Object.entries(content)) {
        escaped[key] = this.escapeHandlebarsContent(value);
      }
      return escaped;
    }
    return content;
  }

  /**
   * Prepare template data for different user types
   */
  private prepareTemplateData(data: NotificationData, userType: string): any {
    // Validate required data
    if (!data) {
      throw new Error('Notification data is undefined');
    }

    const baseData = {
      orderId: data.orderId || 'Unknown',
      orderNumber: data.orderNumber || 'Unknown',
      orderStatus: data.orderStatus || 'Unknown',
      orderItems: data.orderItems || [],
      subtotal: data.subtotal || 0,
      deliveryFee: data.deliveryFee || 0,
      taxAmount: data.taxAmount || 0,
      totalAmount: data.totalAmount || 0,
      currency: data.currency || 'USD',
      deliveryAddress: data.deliveryAddress || 'Unknown Address',
      estimatedDeliveryTime: data.estimatedDeliveryTime,
      deliveryTimeWindow: data.estimatedDeliveryTime, // Use same field for delivery window
      specialInstructions: data.specialInstructions,
      notes: data.notes,
      businessVerified: data.businessVerified || false,
      currentYear: new Date().getFullYear(),
    };

    switch (userType) {
      case 'client':
        if (!data.clientName) {
          throw new Error('Client name is undefined');
        }
        if (!data.businessName) {
          throw new Error('Business name is undefined');
        }
        return this.escapeHandlebarsContent({
          ...baseData,
          recipientName: data.clientName,
          businessName: data.businessName,
          agentName: data.agentName || 'Delivery Agent',
        });
      case 'business':
        if (!data.businessName) {
          throw new Error('Business name is undefined');
        }
        if (!data.clientName) {
          throw new Error('Client name is undefined');
        }
        return this.escapeHandlebarsContent({
          ...baseData,
          recipientName: data.businessName,
          clientName: data.clientName,
          agentName: data.agentName || 'Delivery Agent',
        });
      case 'agent':
        if (!data.agentName) {
          throw new Error('Agent name is undefined');
        }
        if (!data.clientName) {
          throw new Error('Client name is undefined');
        }
        if (!data.businessName) {
          throw new Error('Business name is undefined');
        }
        return this.escapeHandlebarsContent({
          ...baseData,
          recipientName: data.agentName,
          clientName: data.clientName,
          businessName: data.businessName,
        });
      default:
        return this.escapeHandlebarsContent(baseData);
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
    }
  ): Promise<void> {
    try {
      if (!agentEmail) {
        this.logger.warn('Agent email is required for proximity notification');
        return;
      }

      const templateData = this.escapeHandlebarsContent({
        recipientName: agentName,
        orderNumber: orderData.orderNumber,
        orderId: orderData.orderId,
        businessName: orderData.businessName,
        businessAddress: orderData.businessAddress,
        message: `A new order (${orderData.orderNumber}) has been placed at ${orderData.businessName}, located at ${orderData.businessAddress}. You are within 10km of this location.`,
        currentYear: new Date().getFullYear(),
      });

      await this.sendEmail({
        to: agentEmail,
        templateId: this.templateIds.agent_order_proximity,
        dynamicTemplateData: templateData,
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
