import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as Mustache from 'mustache';
import * as path from 'path';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { GET_ORDER_FOR_RECEIPT } from '../orders/orders.queries';
import { UploadService } from '../services/upload.service';
import {
  OrderReceiptData,
  PdfEndpointRequest,
  PdfEndpointResponse,
  ReceiptTemplateData,
} from './types/receipt.types';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly uploadService: UploadService
  ) {}

  /**
   * Generate a receipt PDF for a completed order
   * @param orderId Order ID
   * @param userId User ID (client who placed the order)
   * @returns Promise with upload record details
   */
  async generateReceipt(orderId: string, userId: string): Promise<any> {
    try {
      this.logger.log(`Generating receipt for order ${orderId}`);

      // 1. Get order details
      const orderData = await this.getOrderDetailsForReceipt(orderId);
      if (!orderData) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      // 2. Generate HTML from template
      const html = await this.generateReceiptHtml(orderData);

      // 3. Convert HTML to PDF using PDFEndpoint
      const pdfBuffer = await this.convertHtmlToPdf(html);

      // 4. Upload PDF to S3 and save to user_uploads
      const uploadRecord = await this.uploadReceiptToS3(
        pdfBuffer,
        orderId,
        userId
      );

      this.logger.log(`Receipt generated successfully for order ${orderId}`);
      return uploadRecord;
    } catch (error: any) {
      this.logger.error(
        `Failed to generate receipt for order ${orderId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Fetch order details needed for receipt generation
   * @param orderId Order ID
   * @returns Promise with order data
   */
  private async getOrderDetailsForReceipt(
    orderId: string
  ): Promise<OrderReceiptData | null> {
    try {
      const result = await this.hasuraSystemService.executeQuery(
        GET_ORDER_FOR_RECEIPT,
        {
          orderId,
        }
      );

      return result.orders_by_pk;
    } catch (error: any) {
      this.logger.error(`Failed to fetch order details: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate HTML receipt from template
   * @param orderData Order data
   * @returns Promise with HTML string
   */
  private async generateReceiptHtml(
    orderData: OrderReceiptData
  ): Promise<string> {
    try {
      // Read template file
      const templatePath = path.join(
        __dirname,
        'templates',
        'order-receipt.html'
      );
      const template = fs.readFileSync(templatePath, 'utf8');

      // Prepare template data
      const templateData: ReceiptTemplateData = {
        orderNumber: orderData.order_number,
        orderDate: new Date(orderData.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        completionDate: new Date(orderData.updated_at).toLocaleDateString(
          'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }
        ),
        clientName: `${orderData.client.user.first_name} ${orderData.client.user.last_name}`,
        deliveryAddress: this.formatAddress(orderData.delivery_address),
        businessName: orderData.business.name,
        businessLocation: this.formatAddress(
          orderData.business_location.address
        ),
        agentName: orderData.assigned_agent
          ? `${orderData.assigned_agent.user.first_name} ${orderData.assigned_agent.user.last_name}`
          : undefined,
        orderItems: orderData.order_items.map((item) => ({
          itemName: item.item_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
        })),
        subtotal: orderData.subtotal,
        baseDeliveryFee: orderData.base_delivery_fee,
        perKmDeliveryFee: orderData.per_km_delivery_fee,
        taxAmount: orderData.tax_amount,
        totalAmount: orderData.total_amount,
        currency: orderData.currency,
        paymentStatus: orderData.payment_status,
        currentYear: new Date().getFullYear(),
      };

      // Render template
      const html = Mustache.render(template, templateData);
      return html;
    } catch (error: any) {
      this.logger.error(`Failed to generate HTML: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert HTML to PDF using PDFEndpoint API
   * @param html HTML string
   * @returns Promise with PDF buffer
   */
  private async convertHtmlToPdf(html: string): Promise<Buffer> {
    try {
      const pdfConfig = this.configService.get('pdfEndpoint');

      if (!pdfConfig?.apiToken) {
        throw new HttpException(
          'PDFEndpoint API token not configured',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      const requestData: PdfEndpointRequest = {
        html,
        sandbox: pdfConfig.sandbox,
        options: {
          format: 'A4',
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm',
          },
          orientation: 'portrait',
        },
      };

      const response = await axios.post<PdfEndpointResponse>(
        'https://api.pdfendpoint.com/v1/convert',
        requestData,
        {
          headers: {
            Authorization: `Bearer ${pdfConfig.apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      if (!response.data.success || !response.data.pdf) {
        throw new HttpException(
          `PDF generation failed: ${response.data.error || 'Unknown error'}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(response.data.pdf, 'base64');
      return pdfBuffer;
    } catch (error: any) {
      if (error.response) {
        this.logger.error(
          `PDFEndpoint API error: ${error.response.status} - ${error.response.data}`
        );
        throw new HttpException(
          `PDF generation service error: ${
            error.response.data?.error || error.message
          }`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      } else if (error.code === 'ECONNABORTED') {
        this.logger.error('PDFEndpoint API timeout');
        throw new HttpException(
          'PDF generation timeout',
          HttpStatus.REQUEST_TIMEOUT
        );
      } else {
        this.logger.error(`PDF conversion error: ${error.message}`);
        throw new HttpException(
          'PDF generation failed',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }

  /**
   * Upload PDF to S3 and save record to user_uploads table
   * @param pdfBuffer PDF buffer
   * @param orderId Order ID
   * @param userId User ID
   * @returns Promise with upload record
   */
  private async uploadReceiptToS3(
    pdfBuffer: Buffer,
    orderId: string,
    _userId: string
  ): Promise<any> {
    try {
      const fileName = `receipt-${orderId}-${Date.now()}.pdf`;
      const contentType = 'application/pdf';
      const fileSize = pdfBuffer.length;

      // Generate upload URL and save to user_uploads
      const uploadData = {
        document_type_id: 23, // order_receipt document type
        file_name: fileName,
        content_type: contentType,
        file_size: fileSize,
        note: `Receipt for order ${orderId}`,
      };

      const uploadResult = await this.uploadService.generateUploadUrl(
        uploadData
      );

      // Upload PDF to S3 using presigned URL
      await axios.put(uploadResult.presigned_url, pdfBuffer, {
        headers: {
          'Content-Type': contentType,
        },
        timeout: 30000, // 30 second timeout
      });

      this.logger.log(`PDF uploaded to S3: ${fileName}`);
      return uploadResult.upload_record;
    } catch (error: any) {
      this.logger.error(`Failed to upload PDF to S3: ${error.message}`);
      throw new HttpException(
        'Failed to upload receipt',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Format address object into readable string
   * @param address Address object
   * @returns Formatted address string
   */
  private formatAddress(address: any): string {
    if (!address) return '';

    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);

    return parts.join(', ');
  }
}
