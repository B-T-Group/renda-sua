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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ManufacturerConfirmDto } from './dto/admin-export-order.dto';
import { ExportOrdersFulfillmentService } from './export-orders-fulfillment.service';
import { ExportOrdersService } from './export-orders.service';

@ApiTags('business-export-orders')
@Controller('business/export-orders')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class BusinessExportOrdersController {
  constructor(
    private readonly exportOrders: ExportOrdersService,
    private readonly fulfillment: ExportOrdersFulfillmentService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Manufacturer list of export orders' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async list(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string
  ) {
    const data = await this.exportOrders.listForActor({
      role: 'business',
      page,
      limit,
      status,
    });
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Manufacturer export order detail' })
  async detail(@Param('id') id: string) {
    const data = await this.exportOrders.getById(id);
    return { success: true, data };
  }

  @Post(':id/confirm-quote')
  @ApiOperation({ summary: 'Confirm manufacturer quote / lead time' })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ManufacturerConfirmDto
  ) {
    const data = await this.fulfillment.manufacturerConfirm(id, dto);
    return { success: true, data };
  }

  @Post(':id/mark-ready')
  @ApiOperation({ summary: 'Mark products ready for balance' })
  async markReady(@Param('id') id: string) {
    const data = await this.fulfillment.markReady(id);
    return { success: true, data };
  }
}
