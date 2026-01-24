import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { INSERT_ORDER_LABEL_PRINT } from '../orders/orders.queries';
import { PdfService } from './pdf.service';

const SHIPPING_LABEL_ALLOWED_STATUSES = [
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'complete',
] as const;

const SHIPPING_LABEL_SUPPORTED_LAYOUTS = ['4x6'] as const;
type SupportedLayout = (typeof SHIPPING_LABEL_SUPPORTED_LAYOUTS)[number];

@ApiTags('PDF')
@Controller('pdf')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(
    private readonly pdfService: PdfService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  @Post('receipts/:orderId')
  @ApiOperation({ summary: 'Generate order receipt PDF' })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID for which to generate receipt',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Receipt generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        uploadRecord: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            file_name: { type: 'string' },
            key: { type: 'string' },
            content_type: { type: 'string' },
            file_size: { type: 'number' },
            created_at: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - User does not have permission to generate receipt for this order',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number' },
        message: { type: 'string' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number' },
        message: { type: 'string' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during PDF generation',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number' },
        message: { type: 'string' },
        error: { type: 'string' },
      },
    },
  })
  async generateReceipt(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`Generating receipt for order ${orderId}`);

      // Get current user
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
      }

      // Validate user has permission to generate receipt for this order
      // Only the client who placed the order or admin users can generate receipts
      const hasPermission = await this.validateReceiptPermission(
        orderId,
        user.id
      );
      if (!hasPermission) {
        throw new HttpException(
          'You do not have permission to generate a receipt for this order',
          HttpStatus.FORBIDDEN
        );
      }

      // Generate receipt
      const uploadRecord = await this.pdfService.generateReceipt(
        orderId,
        user.id
      );

      this.logger.log(`Receipt generated successfully for order ${orderId}`);

      return {
        success: true,
        message: 'Receipt generated successfully',
        uploadRecord,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to generate receipt for order ${orderId}: ${error.message}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to generate receipt',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Validate if user has permission to generate receipt for the order
   * @param orderId Order ID
   * @param userId User ID
   * @returns Promise<boolean>
   */
  private async validateReceiptPermission(
    orderId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Query to check if user is the client who placed the order
      const query = `
        query CheckReceiptPermission($orderId: uuid!, $userId: uuid!) {
          orders_by_pk(id: $orderId) {
            id
            client {
              user_id
            }
            business {
              user_id
            }
          }
        }
      `;

      const result = await this.hasuraUserService.executeQuery(query, {
        orderId,
        userId,
      });

      const order = result.orders_by_pk;
      if (!order) {
        return false; // Order not found
      }

      // Check if user is the client who placed the order
      if (order.client?.user_id === userId) {
        return true;
      }

      // Check if user is the business owner (they can also generate receipts)
      if (order.business?.user_id === userId) {
        return true;
      }

      // TODO: Add admin user check if needed
      // For now, only client and business owner can generate receipts

      return false;
    } catch (error: any) {
      this.logger.error(
        `Failed to validate receipt permission: ${error.message}`
      );
      return false;
    }
  }

  @Get('shipping-labels/:orderId')
  @ApiOperation({ summary: 'Generate shipping label PDF for an order' })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'layout',
    required: false,
    enum: ['4x6', 'a4-2up', 'a4-4up'],
    description: 'Label layout (default 4x6)',
  })
  @ApiResponse({ status: 200, description: 'PDF file' })
  @ApiResponse({ status: 400, description: 'Order not eligible for label' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getShippingLabel(
    @Param('orderId') orderId: string,
    @Query('layout') layout: '4x6' | 'a4-2up' | 'a4-4up' = '4x6',
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
      }
      if (
        !SHIPPING_LABEL_SUPPORTED_LAYOUTS.includes(
          layout as SupportedLayout
        )
      ) {
        throw new HttpException(
          `Unsupported layout "${layout}". Only 4x6 is supported.`,
          HttpStatus.BAD_REQUEST
        );
      }
      const validation = await this.validateShippingLabelPermission(
        orderId,
        user.id
      );
      if (!validation.allowed) {
        throw new HttpException(
          validation.reason ??
            'You do not have permission to print a label for this order',
          validation.status ?? HttpStatus.FORBIDDEN
        );
      }
      const buffer = await this.pdfService.generateShippingLabel(
        orderId,
        layout as SupportedLayout
      );
      await this.hasuraSystemService.executeQuery(INSERT_ORDER_LABEL_PRINT, {
        orderId,
        printedByUserId: user.id,
      });
      const orderNumber = validation.orderNumber ?? 'label';
      const filename = `shipping-label-${orderNumber}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      });
      res.end(buffer);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Failed to generate shipping label for ${orderId}: ${error.message}`
      );
      throw new HttpException(
        'Failed to generate shipping label',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async validateShippingLabelPermission(
    orderId: string,
    userId: string
  ): Promise<{
    allowed: boolean;
    orderNumber?: string;
    reason?: string;
    status?: number;
  }> {
    const query = `
      query ValidateShippingLabel($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          business { user_id }
        }
      }
    `;
    try {
      const result = await this.hasuraUserService.executeQuery(query, {
        orderId,
      });
      const order = result.orders_by_pk;
      if (!order) {
        return {
          allowed: false,
          reason: 'Order not found',
          status: HttpStatus.NOT_FOUND,
        };
      }
      if (order.business?.user_id !== userId) {
        return { allowed: false, reason: 'Order does not belong to your business' };
      }
      const status = order.current_status as string;
      if (
        !(SHIPPING_LABEL_ALLOWED_STATUSES as readonly string[]).includes(status)
      ) {
        return {
          allowed: false,
          reason: `Order status "${status}" is not eligible for shipping labels. Order must be confirmed or later.`,
          status: HttpStatus.BAD_REQUEST,
        };
      }
      return {
        allowed: true,
        orderNumber: order.order_number,
      };
    } catch (e: any) {
      this.logger.error(`Validate shipping label permission: ${e.message}`);
      return { allowed: false };
    }
  }

  @Post('shipping-labels/batch')
  @ApiOperation({ summary: 'Generate shipping label PDFs for multiple orders' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
        layout: { type: 'string', enum: ['4x6', 'a4-2up', 'a4-4up'] },
      },
      required: ['orderIds'],
    },
  })
  @ApiResponse({ status: 200, description: 'PDF file' })
  @ApiResponse({ status: 400, description: 'Invalid request or order not eligible' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async batchShippingLabels(
    @Body() body: { orderIds: string[]; layout?: '4x6' | 'a4-2up' | 'a4-4up' },
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
      }
      const orderIds = body?.orderIds;
      if (!Array.isArray(orderIds) || !orderIds.length) {
        throw new HttpException(
          'orderIds must be a non-empty array',
          HttpStatus.BAD_REQUEST
        );
      }
      const layout = (body.layout ?? '4x6') as string;
      if (
        !SHIPPING_LABEL_SUPPORTED_LAYOUTS.includes(layout as SupportedLayout)
      ) {
        throw new HttpException(
          `Unsupported layout "${layout}". Only 4x6 is supported.`,
          HttpStatus.BAD_REQUEST
        );
      }
      for (const orderId of orderIds) {
        const validation = await this.validateShippingLabelPermission(
          orderId,
          user.id
        );
        if (!validation.allowed) {
          throw new HttpException(
            validation.reason ??
              `Order ${orderId}: permission denied or not eligible for labels`,
            validation.status ?? HttpStatus.FORBIDDEN
          );
        }
      }
      const buffer = await this.pdfService.generateShippingLabels(
        orderIds,
        layout as SupportedLayout
      );
      for (const orderId of orderIds) {
        await this.hasuraSystemService.executeQuery(INSERT_ORDER_LABEL_PRINT, {
          orderId,
          printedByUserId: user.id,
        });
      }
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="shipping-labels.pdf"',
      });
      res.end(buffer);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Batch shipping labels failed: ${error.message}`
      );
      throw new HttpException(
        'Failed to generate shipping labels',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
