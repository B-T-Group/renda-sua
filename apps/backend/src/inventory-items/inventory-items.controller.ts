import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import type {
  GetInventoryItemsQuery,
  InventoryItem,
  InventorySearchSuggestion,
  PaginatedInventoryItems,
  TopInventoryLocationRow,
} from './inventory-items.service';
import { InventoryItemsService } from './inventory-items.service';

// Interface for query parameters as they come from HTTP requests (all strings)
interface GetInventoryItemsQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  category?: string;
  subcategory?: string;
  location_name?: string;
  brand?: string;
  min_price?: string;
  max_price?: string;
  currency?: string;
  is_active?: string;
  country_code?: string;
  state?: string;
  sort?: string;
  include_unavailable?: string;
  business_location_id?: string;
  origin_lat?: string;
  origin_lng?: string;
}

interface GetInventorySearchSuggestionsQueryParams
  extends Omit<GetInventoryItemsQueryParams, 'search'> {
  q?: string;
}

@ApiTags('Inventory Items')
@Controller('inventory-items')
export class InventoryItemsController {
  constructor(private readonly inventoryItemsService: InventoryItemsService) {}

  @Public()
  @Get('top-locations')
  @ApiOperation({
    summary:
      'Nearest catalog locations when user address or origin_lat/origin_lng is available; otherwise ranked by item count',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max locations to return (default 5, max 20)',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
    description: 'Same as inventory list (anonymous catalog scope)',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Optional state filter (with country_code)',
  })
  @ApiQuery({
    name: 'origin_lat',
    required: false,
    type: Number,
    description:
      'Browser latitude for nearest ranking (ignored when user has a primary address)',
  })
  @ApiQuery({
    name: 'origin_lng',
    required: false,
    type: Number,
    description:
      'Browser longitude for nearest ranking (ignored when user has a primary address)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Locations with item counts, optional logo_url, optional distance_meters',
  })
  async getTopInventoryLocations(
    @Query('limit') limit?: string,
    @Query('country_code') country_code?: string,
    @Query('state') state?: string,
    @Query('is_active') is_active?: string,
    @Query('include_unavailable') include_unavailable?: string,
    @Query('origin_lat') origin_lat?: string,
    @Query('origin_lng') origin_lng?: string
  ): Promise<{
    success: boolean;
    data: { locations: TopInventoryLocationRow[] };
    message: string;
  }> {
    const n = limit ? Math.min(parseInt(limit, 10) || 5, 20) : 5;
    const lat =
      origin_lat !== undefined ? Number.parseFloat(origin_lat) : undefined;
    const lng =
      origin_lng !== undefined ? Number.parseFloat(origin_lng) : undefined;
    const locations = await this.inventoryItemsService.getTopInventoryLocations(
      n,
      {
        country_code,
        state,
        is_active:
          is_active === 'true'
            ? true
            : is_active === 'false'
              ? false
              : undefined,
        include_unavailable:
          include_unavailable !== undefined
            ? include_unavailable === 'true'
            : undefined,
        ...(Number.isFinite(lat) && { origin_lat: lat }),
        ...(Number.isFinite(lng) && { origin_lng: lng }),
      }
    );
    return {
      success: true,
      data: { locations },
      message: 'Top locations retrieved successfully',
    };
  }

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Get paginated inventory items with optional filters (one listing per catalog item: nearest / most relevant by sort)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Successfully retrieved inventory items. For each product (catalog `item_id`), a single best listing is returned: nearest to the user when address coordinates (or `origin_lat`/`origin_lng`) are available, otherwise the best by the selected sort. When the user is logged in with a primary address, each item may include distance_text, duration_text (and distance_value in meters). Items may include avg_rating and rating_count for display. Results are ordered by the requested sort (relevance, fastest, cheapest, top_rated, or deals).',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                description:
                  'Item may include distance_text, duration_text, distance_value, avg_rating, rating_count',
              },
            },
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
    name: 'subcategory',
    required: false,
    type: String,
    description: 'Filter by subcategory name (exact match)',
  })
  @ApiQuery({
    name: 'location_name',
    required: false,
    type: String,
    description: 'Filter by business location display name (exact match)',
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
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['relevance', 'fastest', 'cheapest', 'top_rated', 'deals'],
    description:
      'Sort order: relevance (views + past orders), fastest (by distance), cheapest, top_rated, or deals only',
  })
  @ApiQuery({
    name: 'include_unavailable',
    required: false,
    type: Boolean,
    description:
      'Include items with zero stock (default: false). When false, only items with computed_available_quantity > 0 are returned.',
  })
  @ApiQuery({
    name: 'business_location_id',
    required: false,
    type: String,
    description: 'Filter to a single business location (UUID)',
  })
  @ApiQuery({
    name: 'origin_lat',
    required: false,
    type: Number,
    description:
      'Approximate latitude for distance (anonymous users; ignored when primary address exists)',
  })
  @ApiQuery({
    name: 'origin_lng',
    required: false,
    type: Number,
    description:
      'Approximate longitude for distance (anonymous users; ignored when primary address exists)',
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
      const validSorts = [
        'relevance',
        'fastest',
        'cheapest',
        'top_rated',
        'deals',
      ] as const;
      const sortParam = query.sort;
      const sort =
        sortParam && validSorts.includes(sortParam as any)
          ? (sortParam as (typeof validSorts)[number])
          : undefined;

      const oLat = query.origin_lat
        ? Number.parseFloat(query.origin_lat)
        : undefined;
      const oLng = query.origin_lng
        ? Number.parseFloat(query.origin_lng)
        : undefined;

      const processedQuery: GetInventoryItemsQuery = {
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        category: query.category,
        subcategory: query.subcategory,
        location_name: query.location_name,
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
        sort,
        include_unavailable:
          query.include_unavailable !== undefined
            ? query.include_unavailable === 'true'
            : undefined,
        business_location_id: query.business_location_id?.trim() || undefined,
        ...(Number.isFinite(oLat) && { origin_lat: oLat }),
        ...(Number.isFinite(oLng) && { origin_lng: oLng }),
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
  @Get('search/suggestions')
  @ApiOperation({
    summary: 'Get grouped search suggestions for the public item catalog',
  })
  @ApiResponse({
    status: 200,
    description: 'Grouped suggestions for terms, products, categories, and sellers',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search prefix (min 2 chars, max 64)',
  })
  @ApiQuery({
    name: 'include_unavailable',
    required: false,
    type: Boolean,
    description: 'Include items with zero stock (default: false)',
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
    description: 'Anonymous catalog scope (overridden by primary address)',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Optional state filter (with country_code)',
  })
  @ApiQuery({
    name: 'business_location_id',
    required: false,
    type: String,
    description: 'Filter to a single business location (UUID)',
  })
  @ApiQuery({
    name: 'origin_lat',
    required: false,
    type: Number,
    description:
      'Approximate latitude for anonymous distance scoping (ignored when primary address exists)',
  })
  @ApiQuery({
    name: 'origin_lng',
    required: false,
    type: Number,
    description:
      'Approximate longitude for anonymous distance scoping (ignored when primary address exists)',
  })
  async getSearchSuggestions(
    @Query() query: GetInventorySearchSuggestionsQueryParams
  ): Promise<{
    success: boolean;
    data: { suggestions: InventorySearchSuggestion[] };
    message: string;
  }> {
    try {
      const oLat = query.origin_lat
        ? Number.parseFloat(query.origin_lat)
        : undefined;
      const oLng = query.origin_lng
        ? Number.parseFloat(query.origin_lng)
        : undefined;

      const suggestions = await this.inventoryItemsService.getInventorySearchSuggestions(
        {
          q: query.q ?? '',
          is_active:
            query.is_active !== undefined ? query.is_active === 'true' : true,
          include_unavailable:
            query.include_unavailable !== undefined
              ? query.include_unavailable === 'true'
              : false,
          country_code: query.country_code,
          state: query.state,
          business_location_id: query.business_location_id?.trim() || undefined,
          ...(Number.isFinite(oLat) && { origin_lat: oLat }),
          ...(Number.isFinite(oLng) && { origin_lng: oLng }),
        }
      );

      return {
        success: true,
        data: { suggestions },
        message: 'Search suggestions retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve search suggestions',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Get(':id/similar')
  @ApiOperation({
    summary: 'Get similar inventory items by shared tags',
  })
  @ApiResponse({
    status: 200,
    description: 'List of similar inventory items (share at least one tag)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        message: { type: 'string' },
      },
    },
  })
  async getSimilarInventoryItems(
    @Param('id') id: string,
    @Query('limit') limit?: string
  ): Promise<{
    success: boolean;
    data: InventoryItem[];
    message: string;
  }> {
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 12, 24) : 12;
    const data =
      await this.inventoryItemsService.getSimilarInventoryItems(id, limitNum);
    return {
      success: true,
      data,
      message: 'Similar items retrieved successfully',
    };
  }

  @Public()
  @Get(':id/seo')
  @ApiProduces('text/html')
  @ApiOperation({
    summary:
      'HTML share landing page with Open Graph tags for crawlers; redirects people to the item page',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML document with meta tags and redirect to the catalog item',
  })
  @ApiResponse({
    status: 404,
    description: 'Item not found; HTML with redirect to catalog',
  })
  async getInventoryItemShareHtml(
    @Param('id') id: string,
    @Res() res: Response
  ): Promise<void> {
    const { statusCode, html } =
      await this.inventoryItemsService.renderInventoryItemSharePage(id);
    res
      .status(statusCode)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'public, max-age=300')
      .send(html);
  }

  @Public()
  @Get(':id/order-stats')
  @ApiOperation({
    summary: 'Public order and view stats for an inventory listing (item detail social proof)',
  })
  @ApiResponse({
    status: 200,
    description: 'Counts for the last 30 days of order line items and last 7 days of view events',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            recentOrders30d: { type: 'number' },
            last7dViews: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to load stats',
  })
  async getInventoryItemOrderStats(@Param('id') id: string): Promise<{
    success: boolean;
    data: { recentOrders30d: number; last7dViews: number };
    message: string;
  }> {
    try {
      const data = await this.inventoryItemsService.getInventoryItemOrderStats(id);
      return {
        success: true,
        data,
        message: 'Order stats retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve order stats',
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
