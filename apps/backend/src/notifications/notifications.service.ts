import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
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
  private readonly sendGridApiKey: string;
  private readonly fromEmail: string;

  // Email template IDs (these will be set after creating templates in SendGrid)
  private readonly templateIds: Record<string, string> = {
    client_order_created: 'd-client-order-created',
    business_order_created: 'd-business-order-created',
    client_order_confirmed: 'd-client-order-confirmed',
    business_order_confirmed: 'd-business-order-confirmed',
    client_order_preparing: 'd-client-order-preparing',
    business_order_preparing: 'd-business-order-preparing',
    client_order_ready_for_pickup: 'd-client-order-ready-for-pickup',
    business_order_ready_for_pickup: 'd-business-order-ready-for-pickup',
    agent_order_assigned: 'd-agent-order-assigned',
    client_order_picked_up: 'd-client-order-picked-up',
    business_order_picked_up: 'd-business-order-picked-up',
    agent_order_picked_up: 'd-agent-order-picked-up',
    client_order_in_transit: 'd-client-order-in-transit',
    business_order_in_transit: 'd-business-order-in-transit',
    agent_order_in_transit: 'd-agent-order-in-transit',
    client_order_out_for_delivery: 'd-client-order-out-for-delivery',
    business_order_out_for_delivery: 'd-business-order-out-for-delivery',
    agent_order_out_for_delivery: 'd-agent-order-out-for-delivery',
    client_order_delivered: 'd-client-order-delivered',
    business_order_delivered: 'd-business-order-delivered',
    agent_order_delivered: 'd-agent-order-delivered',
    client_order_cancelled: 'd-client-order-cancelled',
    business_order_cancelled: 'd-business-order-cancelled',
    agent_order_cancelled: 'd-agent-order-cancelled',
    client_order_failed: 'd-client-order-failed',
    business_order_failed: 'd-business-order-failed',
    agent_order_failed: 'd-agent-order-failed',
    client_order_refunded: 'd-client-order-refunded',
    business_order_refunded: 'd-business-order-refunded',
  };

  constructor(private readonly configService: ConfigService<Configuration>) {
    const emailConfig = this.configService.get('email');
    this.sendGridApiKey = emailConfig?.sendGridApiKey || '';
    this.fromEmail = emailConfig?.sendGridFromEmail || 'noreply@rendasua.com';

    if (this.sendGridApiKey) {
      sgMail.setApiKey(this.sendGridApiKey);
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
        if (this.templateIds[templateKey]) {
          await this.sendEmail({
            to: recipient.email,
            templateId: this.templateIds[templateKey],
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
    if (!this.sendGridApiKey) {
      this.logger.warn('SendGrid API key not configured, skipping email send');
      return;
    }

    const msg = {
      to,
      from: this.fromEmail,
      templateId,
      dynamicTemplateData,
    };

    await sgMail.send(msg);
    this.logger.log(`Email sent to ${to} using template ${templateId}`);
  }

  /**
   * Prepare template data for different user types
   */
  private prepareTemplateData(data: NotificationData, userType: string): any {
    const baseData = {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      orderStatus: data.orderStatus,
      orderItems: data.orderItems,
      subtotal: data.subtotal,
      deliveryFee: data.deliveryFee,
      taxAmount: data.taxAmount,
      totalAmount: data.totalAmount,
      currency: data.currency,
      deliveryAddress: data.deliveryAddress,
      estimatedDeliveryTime: data.estimatedDeliveryTime,
      specialInstructions: data.specialInstructions,
      notes: data.notes,
      currentYear: new Date().getFullYear(),
    };

    switch (userType) {
      case 'client':
        return {
          ...baseData,
          recipientName: data.clientName,
          businessName: data.businessName,
          agentName: data.agentName,
        };
      case 'business':
        return {
          ...baseData,
          recipientName: data.businessName,
          clientName: data.clientName,
          agentName: data.agentName,
        };
      case 'agent':
        return {
          ...baseData,
          recipientName: data.agentName,
          clientName: data.clientName,
          businessName: data.businessName,
        };
      default:
        return baseData;
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
}
