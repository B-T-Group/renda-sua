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
import { RequireRoles } from '../rbac/permissions.decorator';
import { PlatformRoles } from '../rbac/platform-permissions';
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
@RequireRoles(PlatformRoles.SUPERUSER)
@ApiBearerAuth()
export class AdminMapController {
  constructor(private readonly adminMapService: AdminMapService) {}

  @Get('regions')
  @ApiOperation({ summary: 'Market regions configured for a country' })
  @ApiQuery({ name: 'country', required: true, example: 'CM' })
  @ApiResponse({ status: 200, description: 'Region names for the country' })
  regions(@Query('country') country = '') {
    return this.adminMapService.getRegions(country);
  }

  @Get('pins')
  @UsePipes(QUERY_PIPE)
  @ApiOperation({ summary: 'Agent and merchant pins for the superuser map' })
  @ApiResponse({ status: 200, description: 'Pins with contact details' })
  pins(@Query() query: AdminMapPinsQueryDto) {
    return this.adminMapService.getPins(query);
  }
}
