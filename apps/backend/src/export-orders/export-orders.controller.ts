import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
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
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  ClientProformaActionDto,
  ConfirmDeliveryDto,
  SelectBalanceOptionDto,
} from './dto/admin-export-order.dto';
import { CreateExportOrderDto } from './dto/create-export-order.dto';
import { ExportOrdersClientService } from './export-orders-client.service';
import { ExportOrdersService } from './export-orders.service';

@ApiTags('export-orders')
@Controller('export-orders')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ExportOrdersController {
  constructor(
    private readonly exportOrders: ExportOrdersService,
    private readonly clientActions: ExportOrdersClientService,
    private readonly hasuraUser: HasuraUserService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit export interest → SUBMITTED order' })
  @ApiBody({ type: CreateExportOrderDto })
  @ApiResponse({ status: 201, description: 'Export order created' })
  async create(
    @Body() dto: CreateExportOrderDto,
    @ReqContext() ctx: RequestContext
  ) {
    this.requireUser(ctx);
    try {
      const data = await this.exportOrders.createFromInterest(dto);
      return { success: true, data, message: 'Export order submitted' };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, message: error?.message || 'Failed' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('mine')
  @ApiOperation({ summary: 'List export orders for current client' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async listMine(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string
  ) {
    const data = await this.exportOrders.listForActor({
      role: 'client',
      page,
      limit,
      status,
    });
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get export order detail for the current client' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Export order detail' })
  @ApiResponse({ status: 403, description: 'Caller does not own this order' })
  @ApiResponse({ status: 404, description: 'Export order not found' })
  async getOne(@Param('id') id: string, @ReqContext() ctx: RequestContext) {
    this.requireUser(ctx);
    const data = await this.exportOrders.getByIdForActor(id, 'client');
    return { success: true, data };
  }

  @Post(':id/proforma-action')
  @ApiOperation({ summary: 'Approve or request adjustment on proforma' })
  async proformaAction(
    @Param('id') id: string,
    @Body() dto: ClientProformaActionDto
  ) {
    const data = await this.clientActions.handleProforma(id, dto);
    return { success: true, data };
  }

  @Post(':id/resubmit')
  @ApiOperation({ summary: 'Resubmit after CHANGES_REQUESTED' })
  async resubmit(@Param('id') id: string, @Body() body: { note?: string }) {
    const data = await this.exportOrders.clientResubmitAfterChanges(
      id,
      body?.note
    );
    return { success: true, data };
  }

  @Post(':id/balance-option')
  @ApiOperation({ summary: 'Select balance settlement option' })
  async balanceOption(
    @Param('id') id: string,
    @Body() dto: SelectBalanceOptionDto
  ) {
    const data = await this.clientActions.selectBalanceOption(id, dto);
    return { success: true, data };
  }

  @Post(':id/confirm-delivery')
  @ApiOperation({ summary: 'Confirm delivery / reserves' })
  async confirmDelivery(
    @Param('id') id: string,
    @Body() dto: ConfirmDeliveryDto
  ) {
    const data = await this.clientActions.confirmDelivery(id, dto);
    return { success: true, data };
  }

  private requireUser(ctx: RequestContext) {
    const userId = this.hasuraUser.getUserId(ctx);
    if (!userId || userId === 'anonymous') throw new UnauthorizedException();
    return userId;
  }
}
