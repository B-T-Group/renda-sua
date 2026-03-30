import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CsvUploadRequestDto } from './dto/csv-upload.dto';
import { BusinessItemsService } from './business-items.service';
import { ItemDealsService } from '../item-deals/item-deals.service';
import { CreateItemDealDto } from './dto/create-item-deal.dto';
import { UpdateItemDealDto } from './dto/update-item-deal.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateItemFromImageDto } from './dto/create-item-from-image.dto';

const CSV_UPLOAD_ROW_LIMIT = 500;

@ApiTags('business-items')
@Controller('business-items')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BusinessItemsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly businessItemsService: BusinessItemsService,
    private readonly itemDealsService: ItemDealsService
  ) {}

  @Get('page-data')
  @ApiOperation({
    summary: 'Get all page data for business items (items, locations, available-items) in one request',
  })
  @ApiResponse({ status: 200, description: 'Page data retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getPageData() {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const data = await this.businessItemsService.getPageData(businessId);
    return { success: true, data };
  }

  @Get('items')
  @ApiOperation({ summary: 'Get items for the current business' })
  @ApiResponse({ status: 200, description: 'Items retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getItems() {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const items = await this.businessItemsService.getItems(businessId);
    return { success: true, data: { items } };
  }

  @Patch('locations/:locationId')
  @ApiOperation({
    summary: 'Update a business location (e.g. commission percentage)',
  })
  @ApiResponse({ status: 200, description: 'Location updated successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        location_type: { type: 'string', enum: ['store', 'warehouse', 'office', 'pickup_point'] },
        is_active: { type: 'boolean' },
        is_primary: { type: 'boolean' },
        rendasua_item_commission_percentage: { type: 'number', nullable: true },
        auto_withdraw_commissions: {
          type: 'boolean',
          description:
            'When true, order payouts are sent automatically to this location phone when configured.',
        },
        logo_url: {
          type: 'string',
          nullable: true,
          description: 'Public URL for the location logo (S3 or external). Empty clears.',
        },
      },
    },
  })
  async patchLocation(
    @Param('locationId') locationId: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      email?: string;
      location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
      is_active?: boolean;
      is_primary?: boolean;
      rendasua_item_commission_percentage?: number | null;
      auto_withdraw_commissions?: boolean;
      logo_url?: string | null;
    }
  ) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const location = await this.businessItemsService.updateBusinessLocation(
      businessId,
      locationId,
      body
    );
    return { success: true, data: { business_location: location } };
  }

  @Get('locations')
  @ApiOperation({ summary: 'Get business locations for the current business' })
  @ApiResponse({ status: 200, description: 'Locations retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getLocations() {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const [business_locations, primary_address_country] = await Promise.all([
      this.businessItemsService.getBusinessLocations(businessId),
      this.businessItemsService.getBusinessPrimaryAddressCountry(businessId),
    ]);
    return {
      success: true,
      data: { business_locations, primary_address_country },
    };
  }

  @Post('locations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a business location (new address lines, or reuse address_id linked to the business; creates location account)',
  })
  @ApiResponse({ status: 201, description: 'Location created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid body or business has no address for new-address flow' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        address_id: {
          type: 'string',
          format: 'uuid',
          description:
            'Use an existing address already linked to the business (business_addresses). Mutually exclusive with address.',
        },
        address: {
          type: 'object',
          required: ['address_line_1', 'city', 'state'],
          properties: {
            address_line_1: { type: 'string' },
            address_line_2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postal_code: { type: 'string', description: 'Optional; empty string allowed' },
          },
        },
        phone: { type: 'string' },
        email: { type: 'string' },
        location_type: { type: 'string', enum: ['store', 'warehouse', 'office', 'pickup_point'] },
        is_primary: { type: 'boolean' },
        rendasua_item_commission_percentage: { type: 'number', nullable: true },
        auto_withdraw_commissions: {
          type: 'boolean',
          description: 'Defaults to true when omitted.',
        },
        logo_url: {
          type: 'string',
          nullable: true,
          description: 'Optional public URL for the location logo.',
        },
      },
    },
  })
  async createLocation(
    @Body()
    body: {
      name: string;
      address?: {
        address_line_1: string;
        address_line_2?: string;
        city: string;
        state: string;
        postal_code: string;
      };
      address_id?: string;
      phone?: string;
      email?: string;
      location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
      is_primary?: boolean;
      rendasua_item_commission_percentage?: number | null;
      auto_withdraw_commissions?: boolean;
      logo_url?: string | null;
    }
  ) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const location = await this.businessItemsService.createBusinessLocation(businessId, body);
    return { success: true, data: { business_location: location } };
  }

  @Get('available-items')
  @ApiOperation({
    summary: 'Get all active items from verified businesses',
  })
  @ApiResponse({ status: 200, description: 'Available items retrieved successfully' })
  async getAvailableItems() {
    const items = await this.businessItemsService.getAvailableItems();
    return { success: true, data: { items } };
  }

  @Post('create-from-image')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new item for the current business from a business image',
  })
  @ApiResponse({
    status: 201,
    description: 'Item created from image successfully',
  })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiBody({ type: CreateItemFromImageDto })
  async createItemFromImage(@Body() body: CreateItemFromImageDto) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const item = await this.businessItemsService.createItemFromImage(
      businessId,
      body,
      user?.preferred_language ?? 'en'
    );
    return { success: true, data: { item } };
  }

  @Patch('inventory/:inventoryId')
  @ApiOperation({
    summary: 'Update an inventory record for the current business',
  })
  @ApiResponse({ status: 200, description: 'Inventory updated successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        quantity: { type: 'number' },
        reserved_quantity: { type: 'number' },
        reorder_point: { type: 'number' },
        reorder_quantity: { type: 'number' },
        unit_cost: { type: 'number' },
        selling_price: { type: 'number' },
        is_active: { type: 'boolean' },
      },
    },
  })
  async updateInventory(
    @Param('inventoryId') inventoryId: string,
    @Body()
    body: {
      quantity?: number;
      reserved_quantity?: number;
      reorder_point?: number;
      reorder_quantity?: number;
      unit_cost?: number;
      selling_price?: number;
      is_active?: boolean;
    }
  ) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const inventory = await this.businessItemsService.updateInventoryItem(
      businessId,
      inventoryId,
      body
    );
    return { success: true, data: { inventory } };
  }

  @Get('items/:itemId')
  @ApiOperation({
    summary: 'Get a single item for the current business',
  })
  @ApiResponse({ status: 200, description: 'Item retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getItem(@Param('itemId') itemId: string) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    try {
      const item = await this.businessItemsService.getSingleItem(
        businessId,
        itemId
      );
      return { success: true, data: { item } };
    } catch (error: any) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Update an item for the current business',
  })
  @ApiResponse({ status: 200, description: 'Item updated successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Item not found or not owned by business' })
  @ApiBody({ type: UpdateItemDto })
  async updateItem(
    @Param('itemId') itemId: string,
    @Body() body: UpdateItemDto
  ) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }

    const item = await this.businessItemsService.updateItem(
      businessId,
      itemId,
      body
    );
    return { success: true, data: { item } };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an item (set status to deleted, clear location inventories)' })
  @ApiResponse({ status: 204, description: 'Item deleted successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Item not found or not owned by business' })
  async deleteItem(@Param('id') id: string) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    await this.businessItemsService.deleteItem(businessId, id);
  }

  @Post('csv-upload')
  @ApiOperation({
    summary: 'Upload CSV rows to create/update items and inventory',
  })
  @ApiBody({ type: CsvUploadRequestDto })
  @ApiResponse({ status: 200, description: 'CSV processing result with inserted/updated/error counts' })
  @ApiResponse({ status: 400, description: 'Too many rows or invalid body' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async csvUpload(@Body() body: CsvUploadRequestDto) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    const userId = user?.id;
    if (!businessId || !userId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const rows = body?.rows ?? [];
    if (rows.length === 0) {
      return {
        success: true,
        data: {
          success: 0,
          inserted: 0,
          updated: 0,
          errors: 0,
          details: { inserted: [], updated: [], errors: [] },
        },
      };
    }
    if (rows.length > CSV_UPLOAD_ROW_LIMIT) {
      throw new HttpException(
        {
          success: false,
          error: `Too many rows. Maximum ${CSV_UPLOAD_ROW_LIMIT} allowed.`,
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const rowOffset = body?.rowOffset ?? 0;
    const data = await this.businessItemsService.processCsvRows(
      businessId,
      userId,
      rows,
      rowOffset
    );
    return { success: true, data };
  }

  @Get(':inventoryItemId/deals')
  @ApiOperation({
    summary: 'List deals for a specific inventory item of the current business',
  })
  @ApiResponse({
    status: 200,
    description: 'Deals retrieved successfully',
  })
  async getItemDeals(@Param('inventoryItemId') inventoryItemId: string) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const deals = await this.itemDealsService.getDealsForInventory(
      businessId,
      inventoryItemId
    );
    return { success: true, data: { deals } };
  }

  @Post(':inventoryItemId/deals')
  @ApiOperation({
    summary: 'Create a new deal for an inventory item',
  })
  @ApiResponse({
    status: 201,
    description: 'Deal created successfully',
  })
  async createItemDeal(
    @Param('inventoryItemId') inventoryItemId: string,
    @Body() body: CreateItemDealDto
  ) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }

    const deal = await this.itemDealsService.createDeal({
      businessId,
      inventoryItemId,
      discountType: body.discountType,
      discountValue: body.discountValue,
      startAt: body.startAt,
      endAt: body.endAt,
    });

    return { success: true, data: { deal } };
  }

  @Post('deals/:dealId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update an existing deal for the current business',
  })
  @ApiResponse({
    status: 200,
    description: 'Deal updated successfully',
  })
  async updateItemDeal(
    @Param('dealId') dealId: string,
    @Body() body: UpdateItemDealDto
  ) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }

    const deal = await this.itemDealsService.updateDeal({
      businessId,
      dealId,
      updates: {
        discountType: body.discountType,
        discountValue: body.discountValue,
        startAt: body.startAt,
        endAt: body.endAt,
        isActive: body.isActive,
      },
    });

    return { success: true, data: { deal } };
  }

  @Delete('deals/:dealId')
  @ApiOperation({
    summary: 'Delete a deal for the current business',
  })
  @ApiResponse({
    status: 204,
    description: 'Deal deleted successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteItemDeal(@Param('dealId') dealId: string) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }

    await this.itemDealsService.deleteDeal(businessId, dealId);
  }
}
