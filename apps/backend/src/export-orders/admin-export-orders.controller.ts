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
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import {
  AdminReviewDto,
  AttachManufacturerQuoteDto,
  IssueProformaDto,
  RecordShipmentDto,
} from './dto/admin-export-order.dto';
import { ExportOrdersAdminService } from './export-orders-admin.service';
import { ExportOrdersDashboardService } from './export-orders-dashboard.service';
import { ExportOrdersFulfillmentService } from './export-orders-fulfillment.service';
import { ExportOrdersService } from './export-orders.service';

@ApiTags('admin-export-orders')
@Controller('admin/export-orders')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@RequirePermissions(PlatformPermissions.EXPORT_REVIEW)
export class AdminExportOrdersController {
  constructor(
    private readonly admin: ExportOrdersAdminService,
    private readonly exportOrders: ExportOrdersService,
    private readonly fulfillment: ExportOrdersFulfillmentService,
    private readonly dashboard: ExportOrdersDashboardService
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Export orders ops dashboard' })
  async dashboardSummary() {
    const data = await this.dashboard.summary();
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'List all export orders' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async list(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string
  ) {
    const data = await this.admin.list(page, limit, status);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin export order detail' })
  async detail(@Param('id') id: string) {
    const data = await this.exportOrders.getById(id);
    return { success: true, data };
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Approve / request changes / reject' })
  async review(@Param('id') id: string, @Body() dto: AdminReviewDto) {
    const data = await this.admin.review(id, dto);
    return { success: true, data };
  }

  @Post(':id/manufacturer-quote')
  @ApiOperation({ summary: 'Attach manufacturer quote' })
  async mfrQuote(
    @Param('id') id: string,
    @Body() dto: AttachManufacturerQuoteDto
  ) {
    const data = await this.admin.attachManufacturerQuote(id, dto);
    return { success: true, data };
  }

  @Post(':id/proforma')
  @ApiOperation({ summary: 'Enter prices and issue proforma' })
  async proforma(@Param('id') id: string, @Body() dto: IssueProformaDto) {
    const data = await this.admin.issueProforma(id, dto);
    return { success: true, data };
  }

  @Post(':id/mark-ready')
  @ApiOperation({ summary: 'Mark production ready → balance required' })
  async markReady(@Param('id') id: string) {
    const data = await this.fulfillment.adminMarkReady(id);
    return { success: true, data };
  }

  @Post(':id/ship')
  @ApiOperation({ summary: 'Record shipment (requires supplier balance paid)' })
  async ship(@Param('id') id: string, @Body() dto: RecordShipmentDto) {
    const data = await this.fulfillment.ship(id, dto);
    return { success: true, data };
  }
}
