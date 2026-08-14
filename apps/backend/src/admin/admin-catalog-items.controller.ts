import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateItemDto } from '../business-items/dto/update-item.dto';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminCatalogItemsService } from './admin-catalog-items.service';
import { AdminCatalogItemsQueryDto } from './dto/admin-catalog-items-query.dto';

const QUERY_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@ApiTags('admin-catalog-items')
@Controller('admin/items')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.CATALOG_CROSS_BUSINESS)
@ApiBearerAuth()
export class AdminCatalogItemsController {
  constructor(
    private readonly adminCatalogItemsService: AdminCatalogItemsService
  ) {}

  @Get()
  @UsePipes(QUERY_PIPE)
  @ApiOperation({
    summary:
      'Search sale items across businesses (query, business, date, status)',
  })
  @ApiResponse({ status: 200, description: 'Paginated catalog items' })
  async list(@Query() query: AdminCatalogItemsQueryDto) {
    const result = await this.adminCatalogItemsService.list(query);
    return { success: true, ...result };
  }

  @Get(':itemId')
  @ApiOperation({ summary: 'Get a sale item detail for admin edit/cleanup' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Item detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getById(@Param('itemId', ParseUUIDPipe) itemId: string) {
    const item = await this.adminCatalogItemsService.getById(itemId);
    return { success: true, item };
  }

  @Patch(':itemId')
  @ApiOperation({ summary: 'Update a sale item as platform admin' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiBody({ type: UpdateItemDto })
  @ApiResponse({ status: 200, description: 'Updated item' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: UpdateItemDto
  ) {
    const item = await this.adminCatalogItemsService.update(itemId, body);
    return { success: true, item };
  }
}
