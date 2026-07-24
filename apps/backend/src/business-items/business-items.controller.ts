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
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CsvUploadRequestDto } from './dto/csv-upload.dto';
import { BulkVariantPriceOverridesDto } from './dto/bulk-variant-price-overrides.dto';
import { BusinessItemsService } from './business-items.service';
import { BusinessItemsAccessService } from './business-items-access.service';
import { BusinessLocationTransferService } from './business-location-transfer.service';
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
import { CreateLocationTransferRequestDto } from './dto/create-location-transfer-request.dto';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { BusinessAccountTypeService } from './business-account-type.service';
import { ChangeAccountTypeDto } from './dto/change-account-type.dto';

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
    private readonly accessService: BusinessItemsAccessService,
    private readonly transferService: BusinessLocationTransferService,
    private readonly businessAccountTypeService: BusinessAccountTypeService
  ) {}

  @Patch('business/account-type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the account type for the calling merchant (self-serve, 30-day lock-in)' })
  @ApiResponse({ status: 200, description: 'Account type updated successfully' })
  @ApiResponse({ status: 409, description: 'Plan change locked — current plan was changed less than 30 days ago' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async changeAccountType(
    @ReqContext() ctx: RequestContext,
    @Body() body: ChangeAccountTypeDto
  ) {
    const userId = this.hasuraUserService.getUserId(ctx);
    const result = await this.businessAccountTypeService.selfServeChange(
      userId,
      body.accountType
    );
    return { success: true, data: result };
  }

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
    summary: 'Update a business location',
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

  @Get('businesses/search')
  @ApiOperation({
    summary: 'Search businesses by name or email for location transfer',
  })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Businesses matching search' })
  async searchBusinesses(
    @Query('q') q: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    if (!q?.trim()) {
      return { success: true, data: { businesses: [] } };
    }
    const businesses = await this.transferService.searchBusinesses(
      q,
      ctx.targetBusinessId
    );
    return { success: true, data: { businesses } };
  }

  @Get('businesses/:targetBusinessId/locations')
  @ApiOperation({
    summary:
      'List active locations for a destination business (transfer merge picker)',
  })
  @ApiParam({ name: 'targetBusinessId', type: String })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Active locations for business' })
  async listBusinessLocationsForTransfer(
    @Param('targetBusinessId') targetBusinessId: string,
    @Query('businessId') businessId?: string
  ) {
    await this.accessService.resolveAccess(businessId);
    const locations =
      await this.transferService.listActiveLocationsForBusiness(
        targetBusinessId
      );
    return { success: true, data: { locations } };
  }

  @Get('locations/:locationId/transfer-preview')
  @ApiOperation({ summary: 'Preview a business location transfer' })
  @ApiQuery({ name: 'toBusinessId', required: true })
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['location_ownership', 'inventory_merge'],
  })
  @ApiQuery({ name: 'toLocationId', required: false })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Transfer preview' })
  async transferPreview(
    @Param('locationId') locationId: string,
    @Query('toBusinessId') toBusinessId: string,
    @Query('mode') mode?: 'location_ownership' | 'inventory_merge',
    @Query('toLocationId') toLocationId?: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const preview = await this.transferService.preview(
      locationId,
      toBusinessId,
      ctx.targetBusinessId,
      { mode, toLocationId }
    );
    return { success: true, data: preview };
  }

  @Post('locations/:locationId/transfer-requests')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Create a pending location transfer request to another business',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiBody({ type: CreateLocationTransferRequestDto })
  @ApiResponse({ status: 201, description: 'Transfer request created' })
  async createTransferRequest(
    @ReqContext() ctx: RequestContext,
    @Param('locationId') locationId: string,
    @Query('businessId') businessId: string | undefined,
    @Body() body: CreateLocationTransferRequestDto
  ) {
    const accessContext = await this.accessService.resolveAccess(businessId);
    const user = await this.hasuraUserService.getUser(ctx);
    const request = await this.transferService.createRequest({
      locationId,
      toBusinessId: body.toBusinessId,
      confirmBusinessName: body.confirmBusinessName,
      sourceBusinessId: accessContext.targetBusinessId,
      requestedByUserId: user.id,
      mode: body.mode,
      toLocationId: body.toLocationId,
    });
    return { success: true, data: { request } };
  }

  @Get('transfer-requests/pending')
  @ApiOperation({
    summary: 'List incoming and outgoing pending location transfer requests',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Pending transfer requests' })
  async pendingTransferRequests(@Query('businessId') businessId?: string) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const data = await this.transferService.listPendingForBusiness(
      ctx.targetBusinessId
    );
    return { success: true, data };
  }

  @Get('transfer-requests/:id')
  @ApiOperation({
    summary: 'Get a location transfer request by id (source or destination)',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiResponse({ status: 200, description: 'Transfer request' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getTransferRequest(
    @Param('id') id: string,
    @Query('businessId') businessId?: string
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const request = await this.transferService.getForBusiness(
      id,
      ctx.targetBusinessId
    );
    return { success: true, data: { request } };
  }

  @Post('transfer-requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a pending location transfer (destination)' })
  @ApiResponse({ status: 200, description: 'Transfer accepted and applied' })
  async acceptTransferRequest(@Param('id') id: string) {
    const ctx = await this.accessService.resolveAccess();
    const request = await this.transferService.accept(id, ctx.ownBusinessId);
    return { success: true, data: { request } };
  }

  @Post('transfer-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending location transfer (destination)' })
  @ApiResponse({ status: 200, description: 'Transfer rejected' })
  async rejectTransferRequest(@Param('id') id: string) {
    const ctx = await this.accessService.resolveAccess();
    const request = await this.transferService.reject(id, ctx.ownBusinessId);
    return { success: true, data: { request } };
  }

  @Post('transfer-requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending location transfer (source or admin)' })
  @ApiResponse({ status: 200, description: 'Transfer cancelled' })
  async cancelTransferRequest(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Query('businessId') businessId?: string
  ) {
    const accessContext = await this.accessService.resolveAccess(businessId);
    const user = await this.hasuraUserService.getUser(ctx);
    const request = await this.transferService.cancel(id, {
      businessId: accessContext.targetBusinessId,
      isAdmin: accessContext.isPlatformAdmin,
      userId: user.id,
    });
    return { success: true, data: { request } };
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
    @ReqContext() ctx: RequestContext,
    @Query('businessId') businessId: string | undefined,
    @Body() body: CreateItemFromImageDto
  ) {
    const user = await this.hasuraUserService.getUser(ctx);
    const accessContext = await this.accessService.resolveAccess(businessId);
    const item = await this.businessItemsService.createItemFromImage(
      accessContext.targetBusinessId,
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

  @Put('inventory/:inventoryId/variant-price-overrides')
  @ApiOperation({
    summary:
      'Bulk upsert/clear per-variant price overrides for an inventory location',
    description:
      'Shared stock stays on the inventory row. Pass selling_price null to clear an override (inherit variant.price or inventory selling_price).',
  })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiParam({ name: 'inventoryId', description: 'Business inventory UUID' })
  @ApiResponse({ status: 200, description: 'Overrides updated' })
  @ApiResponse({ status: 400, description: 'Variant does not belong to item' })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  async bulkVariantPriceOverrides(
    @Param('inventoryId') inventoryId: string,
    @Query('businessId') businessId: string | undefined,
    @Body() body: BulkVariantPriceOverridesDto
  ) {
    const ctx = await this.accessService.resolveAccess(businessId);
    const data = await this.businessItemsService.bulkSetVariantPriceOverrides(
      ctx.targetBusinessId,
      inventoryId,
      body.overrides ?? []
    );
    return { success: true, data };
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
    @ReqContext() ctx: RequestContext,
    @Query('businessId') businessId: string | undefined,
    @Body() body: CsvUploadRequestDto
  ) {
    const user = await this.hasuraUserService.getUser(ctx);
    const accessContext = await this.accessService.resolveAccess(businessId);
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
      accessContext.targetBusinessId,
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
