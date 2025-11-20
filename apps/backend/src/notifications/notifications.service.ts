import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@sendgrid/mail';
import { Configuration } from '../config/configuration';

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
    agent_order_assigned: 'd-e587fec936c24711a5bfebe57ee15d1d',
    business_order_confirmed: 'd-7a5874cb8d894705be5c5b331e630d19',
    business_order_created: 'd-e0e5e41f79d8475f9e88dcb5e7afec98',
    client_order_cancelled: 'd-e3667da3f8054529a3dfc5b5ee4f95f1',
    client_order_confirmed: 'd-21badee7994540bb8cde3e8ec7ee39c0',
    client_order_created: 'd-74aa38def9c348cc80d5c589f3ea8cdf',
    client_order_delivered: 'd-5f96bbb48dd34a40b1fee42b22cf0790',
    client_order_in_transit: 'd-666a555dd76f40d9bc6402255bfa2c6c',
    client_order_out_for_delivery: 'd-3e9fe8a1d4e744778bd91008d8c886ea',
    client_order_preparing: 'd-657b1957f63a48f9aeccee384277a5a9',
    business_order_preparing: 'd-89feeddf482c4ca9af1fa1a6b09a4eaf',
    client_order_ready_for_pickup: 'd-6d49820c6df446dea974ee4a93e0df59',
    business_order_ready_for_pickup: 'd-3c47eb000b184c3ea543401679ee961b',
    client_order_picked_up: 'd-47b7c243ea92497b8f4b40a0432a280e',
    business_order_picked_up: 'd-111c515f94cf41a8858c1db93178c5b6',
    agent_order_picked_up: 'd-324758d410d14a16a33aa095d134dc2f',
    business_order_in_transit: 'd-43734fc9468a4a96ac08c0742710269b',
    agent_order_in_transit: 'd-228a67c41b984431b7f86b4c8a040db8',
    business_order_out_for_delivery: 'd-353cf8d4d7a54f589e9cfad1e8f47717',
    agent_order_out_for_delivery: 'd-206fbea40a8f4d2b9bb0846f8ca56224',
    business_order_delivered: 'd-350ff14ca0d74582901a0a89c240584c',
    agent_order_delivered: 'd-e4e743ed9b004a149d488e3332a76808',
    business_order_cancelled: 'd-5603e973e3ea4c4380faa1e6a59fd5df',
    agent_order_cancelled: 'd-8d76f4c918694eadbab9aaf6d7c751b3',
    client_order_failed: 'd-a09bd4862ed64a5fbed98a85cbf237e0',
    business_order_failed: 'd-fd95c5d7dc4a4fdc8c91bc28ee2d5395',
    agent_order_failed: 'd-9005ff04f9a64c6ca3c8601d59502ffd',
    client_order_refunded: 'd-5600d6a1da2b4b62a1b3f7322acde542',
    business_order_refunded: 'd-81c4d7b41bc7409c8d9bfe80ed8c7225',
    agent_proximity_order: 'd-e587fec936c24711a5bfebe57ee15d1d', // Using agent_order_assigned template for now
  };

  constructor(private readonly configService: ConfigService<Configuration>) {
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
          await this.sendEmail({
            to: recipient.email,
            templateId: this.templateIds[recipientTemplate],
            dynamicTemplateData: this.prepareTemplateData(data, recipient.type),
          });
        }
      }

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
        templateId: this.templateIds.agent_proximity_order,
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
