import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type {
  GetInventoryItemsQuery,
  InventoryItem,
  PaginatedInventoryItems,
} from './inventory-items.service';
import { InventoryItemsService } from './inventory-items.service';

// Interface for query parameters as they come from HTTP requests (all strings)
interface GetInventoryItemsQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  category?: string;
  brand?: string;
  min_price?: string;
  max_price?: string;
  currency?: string;
  is_active?: string;
  country_code?: string;
  state?: string;
}

@ApiTags('Inventory Items')
@Controller('inventory-items')
export class InventoryItemsController {
  constructor(private readonly inventoryItemsService: InventoryItemsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get paginated inventory items with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved inventory items',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object' } },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term for item name, description, SKU, or brand',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Filter by category name',
  })
  @ApiQuery({
    name: 'brand',
    required: false,
    type: String,
    description: 'Filter by brand name',
  })
  @ApiQuery({
    name: 'min_price',
    required: false,
    type: Number,
    description: 'Minimum price filter',
  })
  @ApiQuery({
    name: 'max_price',
    required: false,
    type: Number,
    description: 'Maximum price filter',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Filter by currency (XAF, USD, etc.)',
  })
  @ApiQuery({
    name: 'is_active',
    required: false,
    type: Boolean,
    description: 'Filter by active status (default: true)',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
    description: 'Filter by country code (e.g., GA for Gabon)',
    example: 'GA',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Filter by state/province name',
    example: 'Littoral',
  })
  async getInventoryItems(
    @Query() query: GetInventoryItemsQueryParams
  ): Promise<{
    success: boolean;
    data: PaginatedInventoryItems;
    message: string;
  }> {
    try {
      // Convert string query parameters to proper types
      const processedQuery: GetInventoryItemsQuery = {
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        category: query.category,
        brand: query.brand,
        min_price: query.min_price ? Number(query.min_price) : undefined,
        max_price: query.max_price ? Number(query.max_price) : undefined,
        currency: query.currency,
        is_active:
          query.is_active !== undefined
            ? query.is_active === 'true'
            : undefined,
        country_code: query.country_code,
        state: query.state,
      };

      const data = await this.inventoryItemsService.getInventoryItems(
        processedQuery
      );

      return {
        success: true,
        data,
        message: 'Inventory items retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve inventory items',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific inventory item by ID' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved inventory item',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Inventory item not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        error: { type: 'string' },
      },
    },
  })
  async getInventoryItemById(@Param('id') id: string): Promise<{
    success: boolean;
    data: InventoryItem;
    message: string;
  }> {
    try {
      const data = await this.inventoryItemsService.getInventoryItemById(id);

      return {
        success: true,
        data,
        message: 'Inventory item retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve inventory item',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
