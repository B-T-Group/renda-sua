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
    agent_order_assigned: 'd-011306bd23654a8bb0a94021a28c79c3',
    business_order_confirmed: 'd-82966f7bda1e4a36bdd7ce82406ffbff',
    business_order_created: 'd-fb71c3dce58345c79a253793d2e6f447',
    client_order_cancelled: 'd-e7fefd5c57bd4c72b854743976e887e2',
    client_order_confirmed: 'd-49f709438596419eb44bccadb126c337',
    client_order_created: 'd-8533720d49f3496ca3d98d8410bdf884',
    client_order_delivered: 'd-31aae0de298349d7973f03cb4928a613',
    client_order_in_transit: 'd-01912584e4ee45a4847ad78fdc06d8e5',
    client_order_out_for_delivery: 'd-187e4321c0a64f54a332f6447d8ed645',
    client_order_preparing: 'd-79ea1676a66b4db8af3c763dc2573513',
    business_order_preparing: 'd-3d50b9e16d654ea2bd99a5c935db38bf',
    client_order_ready_for_pickup: 'd-51540ad69182435091a032039581d409',
    business_order_ready_for_pickup: 'd-6245da2e46fe4875a9da55dff08abd60',
    client_order_picked_up: 'd-86cff255d8154b92b126ee9d6e0ce99c',
    business_order_picked_up: 'd-2b4dcb6fed8149e48c9fac3be901af78',
    agent_order_picked_up: 'd-be471e249ca5475b806a4778c14f93ed',
    business_order_in_transit: 'd-d69c16a4277440179af78cbc62c122f7',
    agent_order_in_transit: 'd-3d40b08448cf4734b938d68bbfd75c5b',
    business_order_out_for_delivery: 'd-9989a2145be9427d94b556bc69af0c60',
    agent_order_out_for_delivery: 'd-abe52042de1a4590b0e4fb95542470b9',
    business_order_delivered: 'd-fbafb8989d054679ae0125135d9c7da9',
    agent_order_delivered: 'd-b10cf77c65e746fa952681709cde98cb',
    business_order_cancelled: 'd-5f7a8de202a04d70b8491ab29b577ba0',
    agent_order_cancelled: 'd-2b91e679f35a44abbdd330d38ccd0723',
    client_order_failed: 'd-c90869e6d9a249c5bfb74263681d13d1',
    business_order_failed: 'd-cd5cefd42b9c475b8fdf004cc4f49bc1',
    agent_order_failed: 'd-f0141b9ec0634398baafd83639a3a096',
    client_order_refunded: 'd-e4fe27661e1449b1b397a3af3805b0ff',
    business_order_refunded: 'd-8159d71b44704f378d64f6cc3f6fdf04',
    agent_order_proximity: 'd-43d66ccd1de74a72b8d5aaf205c45c1a',
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
