import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { GeoScopeService } from '../rbac/geo-scope.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { OrderPickupAnalyticsService } from './order-pickup-analytics.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/pickup-ops')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.ORDERS_CROSS_BUSINESS)
export class AdminPickupOpsController {
  constructor(
    private readonly pickupAnalytics: OrderPickupAnalyticsService,
    private readonly geo: GeoScopeService
  ) {}

  @Get('health')
  @ApiOperation({
    summary: 'Operational health board for assigned pickup orders',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Assigned orders with health state' })
  async getHealth(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 50;
    const orderWhere = await this.orderWhere();
    return this.pickupAnalytics.getOperationalHealth(
      Number.isFinite(parsed) ? parsed : 50,
      orderWhere
    );
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Pickup monitoring KPIs' })
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'ISO timestamp lower bound (default 7 days)',
  })
  @ApiResponse({ status: 200, description: 'Pickup KPI summary' })
  async getKpis(@Query('since') since?: string) {
    return this.pickupAnalytics.getPickupKpis(since, await this.orderWhere());
  }

  private async orderWhere() {
    const scope = await this.geo.require(PlatformPermissions.ORDERS_CROSS_BUSINESS);
    return this.geo.orderWhere(scope);
  }
}
