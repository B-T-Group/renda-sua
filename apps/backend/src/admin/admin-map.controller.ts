import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { GeoScopeService } from '../rbac/geo-scope.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminMapService } from './admin-map.service';
import { AdminMapPinsQueryDto } from './dto/admin-map-query.dto';

const QUERY_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@ApiTags('admin-map')
@Controller('admin/map')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.OPS_MAP)
@ApiBearerAuth()
export class AdminMapController {
  constructor(
    private readonly adminMapService: AdminMapService,
    private readonly geo: GeoScopeService
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Find an agent or merchant on the map' })
  @ApiQuery({ name: 'q', required: true, example: 'Awa' })
  @ApiResponse({ status: 200, description: 'Matching agents and merchants' })
  search(@Query('q') q = '') {
    return this.withAddress((addressWhere) => this.adminMapService.search(q, addressWhere));
  }

  @Get('active-orders')
  @ApiOperation({ summary: 'Active orders that can be located on the map' })
  @ApiQuery({ name: 'q', required: false, example: 'ORD-2026' })
  @ApiResponse({ status: 200, description: 'Open orders, newest first' })
  activeOrders(@Query('q') q = '') {
    return this.withOrders((orderWhere) => this.adminMapService.activeOrders(q, orderWhere));
  }

  @Get('regions')
  @ApiOperation({ summary: 'Market regions configured for a country' })
  @ApiQuery({ name: 'country', required: true, example: 'CM' })
  @ApiResponse({ status: 200, description: 'Region names for the country' })
  async regions(@Query('country') country = '') {
    const scope = await this.geo.require(PlatformPermissions.OPS_MAP);
    return this.adminMapService.getRegions(country, scope);
  }

  @Get('pins')
  @UsePipes(QUERY_PIPE)
  @ApiOperation({ summary: 'Agent and merchant pins for the superuser map' })
  @ApiResponse({
    status: 200,
    description: 'Pins for the map, plus agent and merchant counts by status for the selected market',
  })
  async pins(@Query() query: AdminMapPinsQueryDto) {
    const scope = await this.geo.require(PlatformPermissions.OPS_MAP);
    return this.adminMapService.getPins(query, scope, await this.geo.markets());
  }

  private async withAddress<T>(
    run: (addressWhere: Record<string, unknown> | null) => Promise<T>
  ): Promise<T> {
    const scope = await this.geo.require(PlatformPermissions.OPS_MAP);
    return run(await this.geo.addressWhere(scope));
  }

  private async withOrders<T>(
    run: (orderWhere: Record<string, unknown> | null) => Promise<T>
  ): Promise<T> {
    const scope = await this.geo.require(PlatformPermissions.OPS_MAP);
    return run(await this.geo.orderWhere(scope));
  }
}
