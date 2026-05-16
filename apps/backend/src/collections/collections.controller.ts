import {
  Controller,
  Get,
  Headers,
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
import type { GetInventoryItemsQuery } from '../inventory-items/inventory-items.service';
import { CollectionsService, GetCollectionsQuery } from './collections.service';

interface ListCollectionsQueryParams {
  search?: string;
  featured?: string;
  country_code?: string;
  state?: string;
  origin_lat?: string;
  origin_lng?: string;
  lang?: string;
}

interface CollectionDetailQueryParams extends ListCollectionsQueryParams {
  page?: string;
  limit?: string;
}

@ApiTags('collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List collections with geo-scoped listing counts' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'lang', required: false, enum: ['en', 'fr'] })
  @ApiResponse({ status: 200, description: 'Collections list' })
  async listCollections(
    @Query() query: ListCollectionsQueryParams,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    const data = await this.collectionsService.listCollections(
      this.parseListQuery(query),
      acceptLanguage
    );
    return { success: true, data: { collections: data }, message: 'OK' };
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Collection detail with paginated products' })
  @ApiResponse({ status: 200, description: 'Collection and products' })
  @ApiResponse({ status: 404, description: 'Not found or insufficient listings' })
  async getCollection(
    @Param('slug') slug: string,
    @Query() query: CollectionDetailQueryParams,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    try {
      const catalogQuery = this.parseCatalogQuery(query);
      const result = await this.collectionsService.getCollectionWithProducts(
        slug,
        catalogQuery,
        acceptLanguage
      );
      return {
        success: true,
        data: result,
        message: 'Collection retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to load collection',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private parseListQuery(
    query: ListCollectionsQueryParams
  ): GetCollectionsQuery {
    const oLat = query.origin_lat
      ? Number.parseFloat(query.origin_lat)
      : undefined;
    const oLng = query.origin_lng
      ? Number.parseFloat(query.origin_lng)
      : undefined;
    return {
      search: query.search,
      featured:
        query.featured !== undefined ? query.featured === 'true' : undefined,
      country_code: query.country_code,
      state: query.state,
      lang: query.lang,
      ...(Number.isFinite(oLat) && { origin_lat: oLat }),
      ...(Number.isFinite(oLng) && { origin_lng: oLng }),
    };
  }

  private parseCatalogQuery(
    query: CollectionDetailQueryParams
  ): GetInventoryItemsQuery {
    const base = this.parseListQuery(query);
    return {
      ...base,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 24,
    };
  }
}
