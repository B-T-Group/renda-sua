import {
  Controller,
  Get,
  Post,
  HttpException,
  HttpStatus,
  Query,
  Body,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import {
  CatalogStopsService,
  type TopInCategoryResponse,
  type DealsResponse,
  type EssentialsResponse,
  type FeaturedStoreResponse,
  type BagComplementsResponse,
} from './catalog-stops.service';

interface StopQueryParams {
  country_code?: string;
  state?: string;
  origin_lat?: string;
  origin_lng?: string;
  limit?: string;
}

interface TopInCategoryQueryParams extends StopQueryParams {
  category?: string;
  subcategory?: string;
}

interface BagComplementsBody {
  inventory_item_ids?: string[];
  item_ids?: string[];
}

@ApiTags('Catalog Stops')
@Controller('catalog/stops')
export class CatalogStopsController {
  constructor(
    private readonly catalogStopsService: CatalogStopsService
  ) {}

  @Public()
  @Get('top-in-category')
  @ApiOperation({
    summary: 'Get top items in category (mid-feed rail)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Category name filter',
  })
  @ApiQuery({
    name: 'subcategory',
    required: false,
    type: String,
    description: 'Subcategory name filter',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
    description: 'Country code (CM, GA, etc.)',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'State/province filter',
  })
  @ApiQuery({
    name: 'origin_lat',
    required: false,
    type: Number,
    description: 'Anonymous latitude for distance scoping',
  })
  @ApiQuery({
    name: 'origin_lng',
    required: false,
    type: Number,
    description: 'Anonymous longitude for distance scoping',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max items (default 8, max 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top items in category',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            category_name: { type: 'string' },
            items: { type: 'array', items: { type: 'object' } },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async getTopInCategory(
    @Query() query: TopInCategoryQueryParams
  ): Promise<{
    success: boolean;
    data: TopInCategoryResponse;
    message: string;
  }> {
    try {
      const oLat = query.origin_lat
        ? Number.parseFloat(query.origin_lat)
        : undefined;
      const oLng = query.origin_lng
        ? Number.parseFloat(query.origin_lng)
        : undefined;
      const limit = query.limit ? Number(query.limit) : undefined;

      const data = await this.catalogStopsService.getTopInCategory({
        category: query.category,
        subcategory: query.subcategory,
        country_code: query.country_code,
        state: query.state,
        origin_lat: Number.isFinite(oLat) ? oLat : undefined,
        origin_lng: Number.isFinite(oLng) ? oLng : undefined,
        limit,
      });

      return {
        success: true,
        data,
        message: 'Top items in category retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to retrieve top items',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Get('deals')
  @ApiOperation({
    summary: 'Get active deals (only deal-active inventory rows)',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
    description: 'Country code',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'State/province filter',
  })
  @ApiQuery({
    name: 'origin_lat',
    required: false,
    type: Number,
    description: 'Anonymous latitude',
  })
  @ApiQuery({
    name: 'origin_lng',
    required: false,
    type: Number,
    description: 'Anonymous longitude',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max deals (default 8, max 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Active deals',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object' } },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async getDeals(
    @Query() query: StopQueryParams
  ): Promise<{
    success: boolean;
    data: DealsResponse;
    message: string;
  }> {
    try {
      const oLat = query.origin_lat
        ? Number.parseFloat(query.origin_lat)
        : undefined;
      const oLng = query.origin_lng
        ? Number.parseFloat(query.origin_lng)
        : undefined;
      const limit = query.limit ? Number(query.limit) : undefined;

      const data = await this.catalogStopsService.getDeals({
        country_code: query.country_code,
        state: query.state,
        origin_lat: Number.isFinite(oLat) ? oLat : undefined,
        origin_lng: Number.isFinite(oLng) ? oLng : undefined,
        limit,
      });

      return {
        success: true,
        data,
        message: 'Active deals retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to retrieve deals',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Get('essentials')
  @ApiOperation({
    summary: 'Get featured/essentials collections',
    description:
      'Returns featured collections that have at least 4 in-area listings, with preview image URLs.',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max collections (default 8, max 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured collections',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            collections: { type: 'array', items: { type: 'object' } },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async getEssentials(
    @Query() query: StopQueryParams
  ): Promise<{
    success: boolean;
    data: EssentialsResponse;
    message: string;
  }> {
    try {
      const limit = query.limit ? Number(query.limit) : undefined;

      const data = await this.catalogStopsService.getEssentials({
        country_code: query.country_code,
        state: query.state,
        limit,
      });

      return {
        success: true,
        data,
        message: 'Featured collections retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to retrieve collections',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Get('featured-store')
  @ApiOperation({
    summary: 'Get featured store(s)',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max stores (default 1, max 5)',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured stores',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            stores: { type: 'array', items: { type: 'object' } },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async getFeaturedStore(
    @Query() query: StopQueryParams
  ): Promise<{
    success: boolean;
    data: FeaturedStoreResponse;
    message: string;
  }> {
    try {
      const limit = query.limit ? Number(query.limit) : undefined;

      const data = await this.catalogStopsService.getFeaturedStore({
        country_code: query.country_code,
        state: query.state,
        limit,
      });

      return {
        success: true,
        data,
        message: 'Featured stores retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to retrieve featured stores',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Post('bag-complements')
  @ApiOperation({
    summary: 'Get bag complements (frequently bought together)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        inventory_item_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of inventory item IDs from cart',
        },
        item_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Alternative: array of item IDs',
        },
      },
    },
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max items (default 6, max 12)',
  })
  @ApiResponse({
    status: 200,
    description: 'Bag complement items',
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
                properties: {
                  reason_label: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async getBagComplements(
    @Body() body: BagComplementsBody,
    @Query() query: StopQueryParams
  ): Promise<{
    success: boolean;
    data: BagComplementsResponse;
    message: string;
  }> {
    try {
      const ids = body.inventory_item_ids || body.item_ids || [];

      if (!ids.length) {
        return {
          success: true,
          data: { items: [] },
          message: 'No cart items provided',
        };
      }

      const limit = query.limit ? Number(query.limit) : undefined;

      const data = await this.catalogStopsService.getBagComplements({
        inventory_item_ids: ids,
        country_code: query.country_code,
        state: query.state,
        limit,
      });

      return {
        success: true,
        data,
        message: 'Bag complement items retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to retrieve bag complements',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Get('bag-complements')
  @ApiOperation({
    summary: 'Get bag complements (GET alternative for query-based cart)',
  })
  @ApiQuery({
    name: 'inventory_item_ids',
    required: false,
    type: String,
    description: 'Comma-separated inventory item IDs',
  })
  @ApiQuery({
    name: 'item_ids',
    required: false,
    type: String,
    description: 'Alternative: comma-separated item IDs',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Bag complement items',
  })
  async getBagComplementsGet(
    @Query('inventory_item_ids') inventoryItemIds?: string,
    @Query('item_ids') itemIds?: string,
    @Query() query?: StopQueryParams
  ): Promise<{
    success: boolean;
    data: BagComplementsResponse;
    message: string;
  }> {
    const idsString = inventoryItemIds || itemIds || '';
    const ids = idsString
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    return this.getBagComplements({ inventory_item_ids: ids }, query || {});
  }
}
