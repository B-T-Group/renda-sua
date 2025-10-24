import {
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { PdfService } from './pdf.service';

@ApiTags('PDF')
@Controller('pdf')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(
    private readonly pdfService: PdfService,
    private readonly hasuraUserService: HasuraUserService
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
}
