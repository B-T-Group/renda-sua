import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { ForceRefundDto } from './admin-refunds.dto';
import { OrderRefundsService } from './order-refunds.service';
import { RefundPaymentService } from './refund-payment.service';

@ApiTags('admin')
@Controller('admin/refunds')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminRefundsController {
  constructor(
    private readonly orderRefundsService: OrderRefundsService,
    private readonly refundPaymentService: RefundPaymentService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List refund cases (admin)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200 })
  async listRefunds(@Query('status') status?: string) {
    return this.orderRefundsService.listAllRefundRequestsForAdmin(status);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Refund metrics (admin)' })
  @ApiResponse({ status: 200 })
  async metrics() {
    return this.orderRefundsService.getRefundMetrics();
  }

  @Get('failed-payments')
  @ApiOperation({ summary: 'Failed Stripe/wallet refund payments' })
  @ApiResponse({ status: 200 })
  async failedPayments() {
    return this.orderRefundsService.listFailedPayments();
  }

  @Post('force')
  @ApiOperation({ summary: 'Admin force refund (replaces legacy business button)' })
  @ApiResponse({ status: 200 })
  async forceRefund(@Body() body: ForceRefundDto) {
    return this.orderRefundsService.adminForceRefund(body);
  }

  @Post('payments/:paymentId/retry')
  @ApiOperation({ summary: 'Retry a failed refund payment' })
  @ApiParam({ name: 'paymentId', format: 'uuid' })
  @ApiResponse({ status: 200 })
  async retryPayment(@Param('paymentId') paymentId: string) {
    const result = await this.refundPaymentService.retryPayment(paymentId);
    return { success: result.success, result };
  }
}
