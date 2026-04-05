import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApproveFullRefundDto,
  ApprovePartialRefundDto,
  ApproveReplaceItemDto,
  CreateRefundRequestDto,
  RejectRefundDto,
} from './order-refunds.dto';
import { OrderRefundsService } from './order-refunds.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@Throttle({ short: { limit: 30, ttl: 60000 } })
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class OrderRefundsController {
  constructor(private readonly orderRefundsService: OrderRefundsService) {}

  @Get('refund-requests')
  @ApiOperation({ summary: 'List pending refund requests (business)' })
  @ApiResponse({ status: 200 })
  async listRefundRequests() {
    return this.orderRefundsService.listRefundRequestsForBusiness();
  }

  @Get(':orderId/refund-request')
  @ApiOperation({ summary: 'Get refund request for an order (client or business)' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200 })
  async getRefundRequest(@Param('orderId') orderId: string) {
    return this.orderRefundsService.getRefundRequestByOrderId(orderId);
  }

  @Post(':orderId/refund-request')
  @ApiOperation({ summary: 'Submit a refund request (client)' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 201 })
  async createRefundRequest(
    @Param('orderId') orderId: string,
    @Body() body: CreateRefundRequestDto
  ) {
    return this.orderRefundsService.createRefundRequest(orderId, body);
  }

  @Post(':orderId/refund-request/approve-full')
  @ApiOperation({ summary: 'Approve full refund (business)' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200 })
  async approveFull(
    @Param('orderId') orderId: string,
    @Body() body: ApproveFullRefundDto
  ) {
    return this.orderRefundsService.approveFullRefund(orderId, body);
  }

  @Post(':orderId/refund-request/approve-partial')
  @ApiOperation({ summary: 'Approve partial refund (business)' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200 })
  async approvePartial(
    @Param('orderId') orderId: string,
    @Body() body: ApprovePartialRefundDto
  ) {
    return this.orderRefundsService.approvePartialRefund(orderId, body);
  }

  @Post(':orderId/refund-request/approve-replace-item')
  @ApiOperation({
    summary:
      'Approve item replacement with free delivery (business; no wallet refund)',
  })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200 })
  async approveReplaceItem(
    @Param('orderId') orderId: string,
    @Body() body: ApproveReplaceItemDto
  ) {
    return this.orderRefundsService.approveReplaceItem(orderId, body);
  }

  @Post(':orderId/refund-request/reject')
  @ApiOperation({ summary: 'Reject refund request (business)' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200 })
  async reject(
    @Param('orderId') orderId: string,
    @Body() body: RejectRefundDto
  ) {
    return this.orderRefundsService.rejectRefundRequest(orderId, body);
  }
}
