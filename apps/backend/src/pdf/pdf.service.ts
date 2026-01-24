import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as Mustache from 'mustache';
import * as path from 'path';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  GET_ORDER_FOR_RECEIPT,
  GET_ORDER_FOR_SHIPPING_LABEL,
} from '../orders/orders.queries';
import { UploadService } from '../services/upload.service';
import { generateBarcodeDataUrl } from './barcode.util';
import {
  OrderReceiptData,
  PdfEndpointRequest,
  PdfEndpointResponse,
  ReceiptTemplateData,
} from './types/receipt.types';
import type {
  OrderShippingLabelData,
  ShippingLabelTemplateData,
} from './types/shipping-label.types';

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
   * Call PDFEndpoint /v1/convert and return PDF as Buffer.
   * Supports both url-based response (data.url) and legacy base64 (pdf).
   */
  private async callPdfEndpoint(
    requestData: PdfEndpointRequest
  ): Promise<Buffer> {
    const pdfConfig = this.configService.get('pdfEndpoint');
    if (!pdfConfig?.apiToken) {
      throw new HttpException(
        'PDFEndpoint API token not configured',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    const response = await axios.post<PdfEndpointResponse>(
      'https://api.pdfendpoint.com/v1/convert',
      requestData,
      {
        headers: {
          Authorization: `Bearer ${pdfConfig.apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    const { success, data: resData, pdf: pdfBase64, error } = response.data;
    if (!success) {
      throw new HttpException(
        `PDF generation failed: ${error || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    if (resData?.url) {
      const fileRes = await axios.get<ArrayBuffer>(resData.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      return Buffer.from(fileRes.data);
    }
    if (pdfBase64) {
      return Buffer.from(pdfBase64, 'base64');
    }
    throw new HttpException(
      'PDF generation failed: no PDF data or URL in response',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  /**
   * Call PDFEndpoint /v1/convert and return the PDF URL only (no fetch).
   * Use for shipping labels so the frontend can load and print via URL.
   */
  private async callPdfEndpointForUrl(
    requestData: PdfEndpointRequest
  ): Promise<string> {
    const pdfConfig = this.configService.get('pdfEndpoint');
    if (!pdfConfig?.apiToken) {
      throw new HttpException(
        'PDFEndpoint API token not configured',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    const response = await axios.post<PdfEndpointResponse>(
      'https://api.pdfendpoint.com/v1/convert',
      requestData,
      {
        headers: {
          Authorization: `Bearer ${pdfConfig.apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    const { success, data: resData, error } = response.data;
    if (!success) {
      throw new HttpException(
        `PDF generation failed: ${error || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    if (resData?.url) return resData.url;
    throw new HttpException(
      'PDF generation failed: no URL in response',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  /**
   * Fetch PDF from a URL (e.g. stored label URL or PDFEndpoint) and return as Buffer.
   */
  async fetchPdfFromUrl(url: string): Promise<Buffer> {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    return Buffer.from(res.data);
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
      return this.callPdfEndpoint(requestData);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error.response) {
        this.logger.error(
          `PDFEndpoint API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );
        throw new HttpException(
          `PDF generation service error: ${
            error.response?.data?.error || error.message
          }`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      if (error.code === 'ECONNABORTED') {
        this.logger.error('PDFEndpoint API timeout');
        throw new HttpException(
          'PDF generation timeout',
          HttpStatus.REQUEST_TIMEOUT
        );
      }
      this.logger.error(`PDF conversion error: ${error.message}`);
      throw new HttpException(
        'PDF generation failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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

  /**
   * Fetch order details for shipping label generation
   */
  private async getOrderDetailsForShippingLabel(
    orderId: string
  ): Promise<OrderShippingLabelData | null> {
    try {
      const result = await this.hasuraSystemService.executeQuery(
        GET_ORDER_FOR_SHIPPING_LABEL,
        { orderId }
      );
      return result.orders_by_pk;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch order for shipping label: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Build scheduled delivery time string from windows or fallbacks
   */
  private buildScheduledDeliveryTime(
    order: OrderShippingLabelData
  ): string {
    const win = order.delivery_time_windows?.find((w) => w.is_confirmed);
    if (win) {
      const d = win.preferred_date;
      const start = win.time_slot_start;
      const end = win.time_slot_end;
      const slotName = win.slot?.slot_name;
      if (slotName) return `${d} ${slotName}`;
      return `${d} ${start}–${end}`;
    }
    if (order.preferred_delivery_time) {
      return new Date(order.preferred_delivery_time).toLocaleString();
    }
    if (order.estimated_delivery_time) {
      return new Date(order.estimated_delivery_time).toLocaleString();
    }
    return '—';
  }

  /**
   * Generate HTML for a single shipping label from template data
   */
  private async generateShippingLabelHtml(
    data: ShippingLabelTemplateData
  ): Promise<string> {
    const templatePath = path.join(
      __dirname,
      'templates',
      'shipping-label.html'
    );
    const template = fs.readFileSync(templatePath, 'utf8');
    return Mustache.render(template, data);
  }

  /**
   * Convert label HTML to PDF (4×6 layout). Uses @page { size: 4in 6in; margin: 0 } in HTML.
   * PDFEndpoint page_width/page_height (https://pdfendpoint.com/docs) set to 4in × 6in, zero margin.
   */
  private async convertHtmlToPdfForLabel(html: string): Promise<Buffer> {
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
            top: '0',
            right: '0',
            bottom: '0',
            left: '0',
          },
          orientation: 'portrait',
          page_width: '4in',
          page_height: '6in',
        },
      };
      return this.callPdfEndpoint(requestData);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error.response) {
        this.logger.error(
          `PDFEndpoint API error (label): ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );
        throw new HttpException(
          `PDF generation service error: ${
            error.response?.data?.error || error.message
          }`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      if (error.code === 'ECONNABORTED') {
        this.logger.error('PDFEndpoint API timeout');
        throw new HttpException(
          'PDF generation timeout',
          HttpStatus.REQUEST_TIMEOUT
        );
      }
      this.logger.error(`PDF conversion error (label): ${error.message}`);
      throw new HttpException(
        'PDF generation failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Convert label HTML to PDF and return the PDF URL (no buffer fetch).
   */
  private async convertHtmlToPdfForLabelUrl(html: string): Promise<string> {
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
            top: '0',
            right: '0',
            bottom: '0',
            left: '0',
          },
          orientation: 'portrait',
          page_width: '4in',
          page_height: '6in',
        },
      };
      return this.callPdfEndpointForUrl(requestData);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error.response) {
        this.logger.error(
          `PDFEndpoint API error (label URL): ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );
        throw new HttpException(
          `PDF generation service error: ${
            error.response?.data?.error || error.message
          }`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      if (error.code === 'ECONNABORTED') {
        this.logger.error('PDFEndpoint API timeout');
        throw new HttpException(
          'PDF generation timeout',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      this.logger.error(`PDF conversion error (label URL): ${error.message}`);
      throw new HttpException(
        'PDF generation failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Generate a shipping label PDF for a single order (4×6).
   * @param orderId Order ID
   * @param layout Label layout; only 4x6 supported (a4-2up/a4-4up rejected by controller)
   */
  async generateShippingLabel(
    orderId: string,
    layout: '4x6' | 'a4-2up' | 'a4-4up' = '4x6'
  ): Promise<Buffer> {
    if (layout !== '4x6') {
      throw new HttpException(
        `Unsupported layout "${layout}". Only 4x6 is supported.`,
        HttpStatus.BAD_REQUEST
      );
    }
    const order = await this.getOrderDetailsForShippingLabel(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    const templateData = await this.buildLabelTemplateData(order);
    const html = await this.generateShippingLabelHtml(templateData);
    return this.convertHtmlToPdfForLabel(html);
  }

  /**
   * Generate a shipping label PDF URL for a single order (4×6).
   * Returns the PDFEndpoint URL for frontend print.
   */
  async generateShippingLabelUrl(
    orderId: string,
    layout: '4x6' | 'a4-2up' | 'a4-4up' = '4x6'
  ): Promise<string> {
    if (layout !== '4x6') {
      throw new HttpException(
        `Unsupported layout "${layout}". Only 4x6 is supported.`,
        HttpStatus.BAD_REQUEST
      );
    }
    const order = await this.getOrderDetailsForShippingLabel(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    const templateData = await this.buildLabelTemplateData(order);
    const html = await this.generateShippingLabelHtml(templateData);
    return this.convertHtmlToPdfForLabelUrl(html);
  }

  /**
   * Build template data for one order (shared by single and batch).
   */
  private async buildLabelTemplateData(
    order: OrderShippingLabelData
  ): Promise<ShippingLabelTemplateData> {
    const barcodeDataUrl = await generateBarcodeDataUrl(order.order_number);
    const businessAddress = this.formatAddress(
      order.business_location?.address
    );
    return {
      orderNumber: order.order_number,
      businessName: order.business.name,
      businessAddress,
      businessLocationName: order.business_location?.name ?? '',
      recipientName: `${order.client.user.first_name} ${order.client.user.last_name}`.trim(),
      recipientPhone: order.client.user.phone_number ?? '',
      deliveryAddress: this.formatAddress(order.delivery_address),
      scheduledDeliveryTime: this.buildScheduledDeliveryTime(order),
      fastDelivery: !!order.requires_fast_delivery,
      specialInstructions: order.special_instructions ?? undefined,
      orderItems: order.order_items.map((item) => {
        const parts: string[] = [];
        if (item.weight != null) {
          parts.push(
            item.weight_unit
              ? `${item.weight} ${item.weight_unit}`
              : String(item.weight)
          );
        }
        if (item.dimensions) parts.push(item.dimensions);
        return {
          itemName: item.item_name,
          quantity: item.quantity,
          itemMeta: parts.join(' · '),
        };
      }),
      barcodeDataUrl,
    };
  }

}
