import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import {
  DiscoveryRailsService,
  type TopInCategoryItem,
  type DealItem,
  type FeaturedStore,
  type ComplementItem,
} from './discovery-rails.service';

interface RailQueryParams {
  country_code?: string;
  state?: string;
  origin_lat?: string;
  origin_lng?: string;
  limit?: string;
}

interface ComplementQueryParams extends RailQueryParams {
  cart_item_ids?: string;
}

@ApiTags('Discovery Rails')
@Controller('discovery-rails')
export class DiscoveryRailsController {
  constructor(
    private readonly discoveryRailsService: DiscoveryRailsService
  ) {}

  @Public()
  @Get('top-in-category/:category')
  @ApiOperation({
    summary: 'Get top-rated items in a category (mid-feed rail)',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
    description: 'Filter by country code (e.g., GA, CM)',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Filter by state/province',
  })
  @ApiQuery({
    name: 'origin_lat',
    required: false,
    type: Number,
    description: 'Latitude for anonymous distance scoping',
  })
  @ApiQuery({
    name: 'origin_lng',
    required: false,
    type: Number,
    description: 'Longitude for anonymous distance scoping',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max items to return (default 10, max 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top items in category retrieved successfully',
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
                  id: { type: 'string' },
                  item_id: { type: 'string' },
                  item_name: { type: 'string' },
                  item_description: { type: 'string' },
                  selling_price: { type: 'number' },
                  currency: { type: 'string' },
                  category_name: { type: 'string' },
                  subcategory_name: { type: 'string' },
                  business_location_id: { type: 'string' },
                  location_name: { type: 'string' },
                  business_id: { type: 'string' },
                  business_name: { type: 'string' },
                  avg_rating: { type: 'number', nullable: true },
                  rating_count: { type: 'number', nullable: true },
                  recent_orders_30d: { type: 'number' },
                  image_url: { type: 'string', nullable: true },
                  distance_meters: { type: 'number', nullable: true },
                },
              },
            },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async getTopInCategory(
    @Param('category') category: string,
    @Query() query: RailQueryParams,
    @ReqContext() ctx?: RequestContext
  ): Promise<{
    success: boolean;
    data: { items: TopInCategoryItem[] };
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

      const items = await this.discoveryRailsService.getTopInCategory(
        category,
        {
          country_code: query.country_code,
          state: query.state,
          origin_lat: Number.isFinite(oLat) ? oLat : undefined,
          origin_lng: Number.isFinite(oLng) ? oLng : undefined,
          limit,
        },
        ctx
      );

      return {
        success: true,
        data: { items },
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
  @Get('deals-near-you')
  @ApiOperation({
    summary: 'Get active deals near the user or in their fulfillment scope',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
    description: 'Filter by country code',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Filter by state/province',
  })
  @ApiQuery({
    name: 'origin_lat',
    required: false,
    type: Number,
    description: 'Latitude for anonymous distance scoping',
  })
  @ApiQuery({
    name: 'origin_lng',
    required: false,
    type: Number,
    description: 'Longitude for anonymous distance scoping',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max deals to return (default 10, max 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Active deals retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            deals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  item_id: { type: 'string' },
                  item_name: { type: 'string' },
                  item_description: { type: 'string' },
                  original_price: { type: 'number' },
                  discounted_price: { type: 'number' },
                  currency: { type: 'string' },
                  discount_type: { type: 'string', enum: ['percentage', 'fixed'] },
                  discount_value: { type: 'number' },
                  deal_end_at: { type: 'string', format: 'date-time' },
                  business_location_id: { type: 'string' },
                  location_name: { type: 'string' },
                  business_id: { type: 'string' },
                  business_name: { type: 'string' },
                  category_name: { type: 'string' },
                  subcategory_name: { type: 'string' },
                  image_url: { type: 'string', nullable: true },
                  distance_meters: { type: 'number', nullable: true },
                },
              },
            },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async getDealsNearYou(
    @Query() query: RailQueryParams,
    @ReqContext() ctx?: RequestContext
  ): Promise<{
    success: boolean;
    data: { deals: DealItem[] };
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

      const deals = await this.discoveryRailsService.getDealsNearYou(
        {
          country_code: query.country_code,
          state: query.state,
          origin_lat: Number.isFinite(oLat) ? oLat : undefined,
          origin_lng: Number.isFinite(oLng) ? oLng : undefined,
          limit,
        },
        ctx
      );

      return {
        success: true,
        data: { deals },
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
  @Get('featured-stores')
  @ApiOperation({
    summary: 'Get featured stores/merchants in the fulfillment scope',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
    description: 'Filter by country code',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Filter by state/province',
  })
  @ApiQuery({
    name: 'origin_lat',
    required: false,
    type: Number,
    description: 'Latitude for anonymous distance scoping',
  })
  @ApiQuery({
    name: 'origin_lng',
    required: false,
    type: Number,
    description: 'Longitude for anonymous distance scoping',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max stores to return (default 5, max 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured stores retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            stores: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  business_id: { type: 'string' },
                  business_location_id: { type: 'string' },
                  location_name: { type: 'string' },
                  business_name: { type: 'string' },
                  storefront_visible: { type: 'boolean' },
                  logo_url: { type: 'string', nullable: true },
                  cover_image_url: { type: 'string', nullable: true },
                  description: { type: 'string', nullable: true },
                  country_code: { type: 'string' },
                  state: { type: 'string', nullable: true },
                  city: { type: 'string', nullable: true },
                  total_items: { type: 'number' },
                  avg_rating: { type: 'number', nullable: true },
                  total_ratings: { type: 'number', nullable: true },
                  distance_meters: { type: 'number', nullable: true },
                },
              },
            },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async getFeaturedStores(
    @Query() query: RailQueryParams,
    @ReqContext() ctx?: RequestContext
  ): Promise<{
    success: boolean;
    data: { stores: FeaturedStore[] };
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

      const stores = await this.discoveryRailsService.getFeaturedStores(
        {
          country_code: query.country_code,
          state: query.state,
          origin_lat: Number.isFinite(oLat) ? oLat : undefined,
          origin_lng: Number.isFinite(oLng) ? oLng : undefined,
          limit,
        },
        ctx
      );

      return {
        success: true,
        data: { stores },
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
  @Get('bag-complements')
  @ApiOperation({
    summary: 'Get complementary items for cart (frequently bought together)',
  })
  @ApiQuery({
    name: 'cart_item_ids',
    required: true,
    type: String,
    description: 'Comma-separated list of item IDs in the cart',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    type: String,
    description: 'Filter by country code',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Filter by state/province',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max complement items to return (default 6, max 12)',
  })
  @ApiResponse({
    status: 200,
    description: 'Bag complement items retrieved successfully',
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
                  id: { type: 'string' },
                  item_id: { type: 'string' },
                  item_name: { type: 'string' },
                  item_description: { type: 'string' },
                  selling_price: { type: 'number' },
                  currency: { type: 'string' },
                  category_name: { type: 'string' },
                  subcategory_name: { type: 'string' },
                  business_location_id: { type: 'string' },
                  image_url: { type: 'string', nullable: true },
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
    @Query() query: ComplementQueryParams
  ): Promise<{
    success: boolean;
    data: { items: ComplementItem[] };
    message: string;
  }> {
    try {
      if (!query.cart_item_ids) {
        return {
          success: true,
          data: { items: [] },
          message: 'No cart items provided',
        };
      }

      const cartItemIds = query.cart_item_ids
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      if (!cartItemIds.length) {
        return {
          success: true,
          data: { items: [] },
          message: 'No valid cart items provided',
        };
      }

      const limit = query.limit ? Number(query.limit) : undefined;

      const items = await this.discoveryRailsService.getBagComplements(
        cartItemIds,
        {
          country_code: query.country_code,
          state: query.state,
          limit,
        }
      );

      return {
        success: true,
        data: { items },
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
}
