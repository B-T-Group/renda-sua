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
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CsvUploadRequestDto } from './dto/csv-upload.dto';
import { BusinessItemsService } from './business-items.service';
import { BusinessItemsAccessService } from './business-items-access.service';
import { ItemDealsService } from '../item-deals/item-deals.service';
import { CreateItemDealDto } from './dto/create-item-deal.dto';
import { UpdateItemDealDto } from './dto/update-item-deal.dto';
import { CreateItemDto } from '../items/dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateItemFromImageDto } from './dto/create-item-from-image.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateItemPromotionDto } from './dto/update-item-promotion.dto';
import { SetItemFavoriteDto } from './dto/set-item-favorite.dto';
import { SetItemCollectionsDto } from './dto/set-item-collections.dto';

const CSV_UPLOAD_ROW_LIMIT = 500;

@ApiTags('business-items')
@Controller('business-items')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BusinessItemsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly businessItemsService: BusinessItemsService,
    private readonly itemDealsService: ItemDealsService,
    private readonly accessService: BusinessItemsAccessService
  ) {}

  @Get('page-data')
  @ApiOperation({
    summary:
      'Get all page data for business items (items, locations, available-items) in one request',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Page data retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getPageData(@Query('businessId') businessId?: string) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const data = await this.businessItemsService.getPageData(
      ctx.targetBusinessId
    );
    return { success: true, data };
  }

  @Get('items')
  @ApiOperation({ summary: 'Get items for the current business' })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Items retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getItems(@Query('businessId') businessId?: string) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const items = await this.businessItemsService.getItems(ctx.targetBusinessId);
    return { success: true, data: { items } };
  }

  @Patch('locations/:locationId')
  @ApiOperation({
    summary: 'Update a business location (e.g. commission percentage)',
  })
  @ApiQuery({ name: 'businessId', required: false })
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
        location_type: {
          type: 'string',
          enum: ['store', 'warehouse', 'office', 'pickup_point'],
        },
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
    @Query('businessId') businessId: string | undefined,
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
    const ctx = await this.accessService.resolveAccess(businessId);
    const location = await this.businessItemsService.updateBusinessLocation(
      ctx.targetBusinessId,
      locationId,
      body
    );
    return { success: true, data: { business_location: location } };
  }

  @Delete('locations/:locationId')
  @ApiOperation({
    summary: 'Delete a business location with safeguards (only/primary location rejected)',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Location deleted successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Cannot delete location due to safeguards',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
        code: {
          type: 'string',
          enum: [
            'ADDRESS_MINIMUM_REQUIRED',
            'ADDRESS_PRIMARY_DELETE_FORBIDDEN',
          ],
          description:
            'ADDRESS_MINIMUM_REQUIRED: Cannot delete the only location. ADDRESS_PRIMARY_DELETE_FORBIDDEN: Cannot delete the primary location.',
        },
      },
    },
  })
  async deleteLocation(
    @Param('locationId') locationId: string,
    @Query('businessId') businessId: string | undefined
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const result = await this.businessItemsService.deleteBusinessLocation(
      ctx.targetBusinessId,
      locationId
    );
    return { success: result.success, message: result.message };
  }

  @Get('locations')
  @ApiOperation({ summary: 'Get business locations for the current business' })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Locations retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getLocations(@Query('businessId') businessId?: string) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const [business_locations, primary_address_country] = await Promise.all([
      this.businessItemsService.getBusinessLocations(ctx.targetBusinessId),
      this.businessItemsService.getBusinessPrimaryAddressCountry(
        ctx.targetBusinessId
      ),
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
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 201, description: 'Location created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid body or business has no address for new-address flow',
  })
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
            postal_code: {
              type: 'string',
              description: 'Optional; empty string allowed',
            },
          },
        },
        phone: { type: 'string' },
        email: { type: 'string' },
        location_type: {
          type: 'string',
          enum: ['store', 'warehouse', 'office', 'pickup_point'],
        },
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
    @Query('businessId') businessId: string | undefined,
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
    const ctx = await this.accessService.resolveAccess(businessId);
    const location = await this.businessItemsService.createBusinessLocation(
      ctx.targetBusinessId,
      body
    );
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
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({
    status: 201,
    description: 'Item created from image successfully',
  })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiBody({ type: CreateItemFromImageDto })
  async createItemFromImage(
    @Query('businessId') businessId: string | undefined,
    @Body() body: CreateItemFromImageDto
  ) {
    const user = await this.hasuraUserService.getUser();
    const ctx = await this.accessService.resolveAccess(businessId);
    const item = await this.businessItemsService.createItemFromImage(
      ctx.targetBusinessId,
      body,
      user?.preferred_language ?? 'en'
    );
    return { success: true, data: { item } };
  }

  @Post('inventory')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an inventory record for the current business',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 201, description: 'Inventory created successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Item or location not found' })
  @ApiBody({ type: CreateInventoryDto })
  async createInventory(
    @Query('businessId') businessId: string | undefined,
    @Body() body: CreateInventoryDto
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const inventory = await this.businessItemsService.createInventoryItem(
      ctx.targetBusinessId,
      body
    );
    return { success: true, data: { inventory } };
  }

  @Patch('inventory/:inventoryId')
  @ApiOperation({
    summary: 'Update an inventory record for the current business',
  })
  @ApiQuery({ name: 'businessId', required: false })
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
        promotion: {
          type: 'object',
          nullable: true,
          description: 'JSON promotion payload or null to clear',
        },
      },
    },
  })
  async updateInventory(
    @Param('inventoryId') inventoryId: string,
    @Query('businessId') businessId: string | undefined,
    @Body()
    body: {
      quantity?: number;
      reserved_quantity?: number;
      reorder_point?: number;
      reorder_quantity?: number;
      unit_cost?: number;
      selling_price?: number;
      is_active?: boolean;
      promotion?: Record<string, unknown> | null;
    }
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const inventory = await this.businessItemsService.updateInventoryItem(
      ctx.targetBusinessId,
      inventoryId,
      body
    );
    return { success: true, data: { inventory } };
  }

  @Get('items/:itemId')
  @ApiOperation({
    summary: 'Get a single item for the current business',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Item retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getItem(
    @Param('itemId') itemId: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    try {
      const item = await this.businessItemsService.getSingleItem(
        ctx.targetBusinessId,
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

  @Patch('items/:itemId/promotion')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary:
      'Set promotion on all inventory rows for this item within the business',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Promotion updated' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiBody({ type: UpdateItemPromotionDto })
  async updateItemPromotion(
    @Param('itemId') itemId: string,
    @Query('businessId') businessId: string | undefined,
    @Body() body: UpdateItemPromotionDto
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    this.accessService.assertPlatformAdmin(ctx);
    const result = await this.businessItemsService.setPromotionForItem(
      ctx.targetBusinessId,
      itemId,
      body
    );
    return { success: true, data: result };
  }

  @Post('items')
  @ApiOperation({ summary: 'Create a catalog item for the current business' })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 201, description: 'Item created successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiBody({ type: CreateItemDto })
  async createItem(
    @Query('businessId') businessId: string | undefined,
    @Body() body: CreateItemDto
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const item = await this.businessItemsService.createItem(
      ctx.targetBusinessId,
      body
    );
    return { success: true, data: { item } };
  }

  @Post('items/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Publish a draft sale item (submits for AI/manual moderation)',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Item submitted for review' })
  @ApiResponse({ status: 400, description: 'Item is not a draft' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async publishItem(
    @Param('id') itemId: string,
    @Query('businessId') businessId: string | undefined
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const item = await this.businessItemsService.publishBusinessItem(
      ctx.targetBusinessId,
      itemId
    );
    return { success: true, data: { item } };
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Update an item for the current business',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Item updated successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({
    status: 404,
    description: 'Item not found or not owned by business',
  })
  @ApiBody({ type: UpdateItemDto })
  async updateItem(
    @Param('itemId') itemId: string,
    @Query('businessId') businessId: string | undefined,
    @Body() body: UpdateItemDto
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const item = await this.businessItemsService.updateItem(
      ctx.targetBusinessId,
      itemId,
      body
    );
    return { success: true, data: { item } };
  }

  @Put('items/:itemId/favorite')
  @ApiOperation({
    summary: 'Mark or unmark an item as a business favorite (catalog bookmark)',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Favorite status updated' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Item not found for this business' })
  @ApiBody({ type: SetItemFavoriteDto })
  async setItemFavorite(
    @Param('itemId') itemId: string,
    @Query('businessId') businessId: string | undefined,
    @Body() body: SetItemFavoriteDto
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    await this.businessItemsService.setItemFavorite(
      ctx.targetBusinessId,
      itemId,
      body.favorited
    );
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete an item (set status to deleted, clear location inventories)',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 204, description: 'Item deleted successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({
    status: 404,
    description: 'Item not found or not owned by business',
  })
  async deleteItem(
    @Param('id') id: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    this.accessService.assertCanDelete(ctx);
    await this.businessItemsService.deleteItem(ctx.targetBusinessId, id);
  }

  @Post('csv-upload')
  @ApiOperation({
    summary: 'Upload CSV rows to create/update items and inventory',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiBody({ type: CsvUploadRequestDto })
  @ApiResponse({
    status: 200,
    description: 'CSV processing result with inserted/updated/error counts',
  })
  @ApiResponse({ status: 400, description: 'Too many rows or invalid body' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async csvUpload(
    @Query('businessId') businessId: string | undefined,
    @Body() body: CsvUploadRequestDto
  ) {
    const user = await this.hasuraUserService.getUser();
    const ctx = await this.accessService.resolveAccess(businessId);
    const userId = user?.id;
    if (!userId) {
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
      ctx.targetBusinessId,
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
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Deals retrieved successfully',
  })
  async getItemDeals(
    @Param('inventoryItemId') inventoryItemId: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    this.accessService.assertPlatformAdmin(ctx);
    const deals = await this.itemDealsService.getDealsForInventory(
      ctx.targetBusinessId,
      inventoryItemId
    );
    return { success: true, data: { deals } };
  }

  @Post(':inventoryItemId/deals')
  @ApiOperation({
    summary: 'Create a new deal for an inventory item',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({
    status: 201,
    description: 'Deal created successfully',
  })
  async createItemDeal(
    @Param('inventoryItemId') inventoryItemId: string,
    @Query('businessId') businessId: string | undefined,
    @Body() body: CreateItemDealDto
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    this.accessService.assertPlatformAdmin(ctx);
    const deal = await this.itemDealsService.createDeal({
      businessId: ctx.targetBusinessId,
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
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Deal updated successfully',
  })
  async updateItemDeal(
    @Param('dealId') dealId: string,
    @Query('businessId') businessId: string | undefined,
    @Body() body: UpdateItemDealDto
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    this.accessService.assertPlatformAdmin(ctx);
    const deal = await this.itemDealsService.updateDeal({
      businessId: ctx.targetBusinessId,
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
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({
    status: 204,
    description: 'Deal deleted successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteItemDeal(
    @Param('dealId') dealId: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    this.accessService.assertPlatformAdmin(ctx);
    await this.itemDealsService.deleteDeal(ctx.targetBusinessId, dealId);
  }

  @Get('collections')
  @ApiOperation({
    summary: 'List platform collections with optional assignment state',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Collections retrieved' })
  async listCollections(
    @Query('itemId') itemId?: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    this.accessService.assertPlatformAdmin(ctx);
    const collections = await this.businessItemsService.listAllCollections(
      itemId,
      ctx.targetBusinessId
    );
    return { success: true, data: { collections } };
  }

  @Get('items/:itemId/collection-suggestions')
  @ApiOperation({ summary: 'Suggested collections for an item (AI)' })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Suggestions retrieved' })
  async getItemCollectionSuggestions(
    @Param('itemId') itemId: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    this.accessService.assertPlatformAdmin(ctx);
    const suggestions =
      await this.businessItemsService.getItemCollectionSuggestions(
        ctx.targetBusinessId,
        itemId
      );
    return { success: true, data: { suggestions } };
  }

  @Put('items/:itemId/collections')
  @ApiOperation({ summary: 'Replace item collection assignments' })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiBody({ type: SetItemCollectionsDto })
  @ApiResponse({ status: 200, description: 'Collections updated' })
  async setItemCollections(
    @Param('itemId') itemId: string,
    @Query('businessId') businessId: string | undefined,
    @Body() body: SetItemCollectionsDto
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    this.accessService.assertPlatformAdmin(ctx);
    await this.businessItemsService.setItemCollections(
      ctx.targetBusinessId,
      itemId,
      body.collectionIds ?? []
    );
    return { success: true, message: 'Collections updated' };
  }
}
