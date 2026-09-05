import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
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
import { AiService } from './ai.service';
import { GenerateDescriptionDto } from './dto/generate-description.dto';
import { ImageItemSuggestionsDto } from './dto/image-item-suggestions.dto';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { BusinessImagesService } from '../business-images/business-images.service';
import { BusinessItemsService } from '../business-items/business-items.service';
import { ItemRefinementDto } from './dto/item-refinement.dto';
import { VariantSuggestionsDto } from './dto/variant-suggestions.dto';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import {
  computeListingQuality,
  nameSimilarity,
} from './listing-quality.util';
import { CategoriesService } from '../categories/categories.service';
import {
  formatCatalogForVisionPrompt,
  remapImageItemSuggestionCategories,
} from '../categories/match-item-category';
import {
  buildVariantParentSnapshot,
  sanitizeVariantImageIds,
} from './variant-parent-snapshot.util';

@ApiTags('ai')
@Controller('ai')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly businessImagesService: BusinessImagesService,
    private readonly businessItemsService: BusinessItemsService,
    private readonly categoriesService: CategoriesService
  ) {}

  @Post('generate-description')
  @ApiOperation({
    summary: 'Generate AI-powered product description',
    description:
      'Generate a compelling product description using DeepSeek (chat API) based on product details',
  })
  @ApiBody({
    type: GenerateDescriptionDto,
    description: 'Product details for description generation',
  })
  @ApiResponse({
    status: 200,
    description: 'Product description generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        description: {
          type: 'string',
          example:
            'Experience premium sound quality with our wireless Bluetooth headphones. Featuring advanced noise cancellation and 30-hour battery life, these headphones deliver exceptional audio performance for both work and leisure.',
        },
        message: {
          type: 'string',
          example: 'Product description generated successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Validation failed' },
        error: { type: 'string', example: 'Invalid input data' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid API key or authentication required',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - DeepSeek API rate limit exceeded',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Failed to generate description',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'Failed to generate product description',
        },
        error: { type: 'string', example: 'DeepSeek API error' },
      },
    },
  })
  async generateProductDescription(@Body() dto: GenerateDescriptionDto) {
    try {
      const result = await this.aiService.generateProductDescription(dto);

      return {
        success: result.success,
        description: result.description,
        message: result.message,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        {
          success: false,
          message: 'Failed to generate product description',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('image-item-suggestions')
  @ApiOperation({
    summary: 'Get AI-based item field suggestions from a business image',
  })
  @ApiBody({ type: ImageItemSuggestionsDto })
  @ApiResponse({
    status: 200,
    description: 'Suggestions generated successfully',
  })
  async getImageItemSuggestions(
    @ReqContext() ctx: RequestContext,
    @Body() body: ImageItemSuggestionsDto
  ) {
    const user = await this.hasuraUserService.getUser(ctx);
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const ids =
      body.imageIds?.length && Array.isArray(body.imageIds)
        ? [...new Set(body.imageIds.filter(Boolean))]
        : body.imageId
        ? [body.imageId]
        : [];
    if (!ids.length) {
      throw new HttpException(
        { success: false, error: 'imageId or imageIds is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    const images = await Promise.all(
      ids.map((id) =>
        this.businessImagesService.getImageForBusiness(businessId, id)
      )
    );
    if (images.some((img) => !img)) {
      throw new HttpException(
        { success: false, error: 'One or more images not found' },
        HttpStatus.NOT_FOUND
      );
    }

    const captions = images
      .map((img) => img!.caption)
      .filter((c): c is string => !!c?.trim());
    const alts = images
      .map((img) => img!.alt_text)
      .filter((a): a is string => !!a?.trim());

    const [currency, country, catalogItems, categoryTree] = await Promise.all([
      this.hasuraSystemService.resolveBusinessCurrency(businessId),
      this.hasuraSystemService.getBusinessPrimaryAddressCountry(businessId),
      this.businessItemsService.getItems(businessId),
      this.categoriesService.listCategoryTree(),
    ]);

    const linkedItemIds = new Set(
      images
        .map((img) => img!.item_id)
        .filter((id): id is string => typeof id === 'string' && !!id)
    );
    const catalogForContext = (
      catalogItems as {
        id: string;
        name?: string;
        moderation_status?: string;
        brand?: { name?: string } | null;
      }[]
    ).filter(
      (i) =>
        !linkedItemIds.has(i.id) &&
        i.moderation_status !== 'draft' &&
        (i.name ?? '').trim().toLowerCase() !== 'untitled product'
    );

    const existingCatalogNames = catalogForContext
      .map((i) => i.name)
      .filter((n): n is string => !!n?.trim());
    const existingBrandNames = [
      ...new Set(
        catalogForContext
          .map((i) => i.brand?.name)
          .filter((n): n is string => !!n?.trim())
      ),
    ];

    const suggestionRaw = await this.aiService.generateImageItemSuggestions({
      imageUrls: images.map((img) => img!.image_url),
      caption: captions.length ? captions.join(' | ') : null,
      altText: alts.length ? alts.join(' | ') : null,
      hint: body.hint?.trim() || null,
      defaultCurrency: currency || 'XAF',
      preferredLanguage: user?.preferred_language ?? 'en',
      country,
      existingCatalogNames,
      existingBrandNames,
      existingCatalogPrompt: formatCatalogForVisionPrompt(categoryTree),
      isFoodItem: body.isFoodItem === true ? true : undefined,
    });
    const suggestion = remapImageItemSuggestionCategories(
      suggestionRaw,
      categoryTree
    );

    if (suggestion.barcodeValues?.length) {
      await this.businessImagesService.storeBarcodeValuesOnImage(
        businessId,
        images[0]!.id,
        suggestion.barcodeValues
      );
    }

    const scoredImages = images.filter(
      (img) => typeof img!.quality_score === 'number'
    );
    const avgQuality =
      scoredImages.length > 0
        ? scoredImages.reduce(
            (sum, img) => sum + (img!.quality_score as number),
            0
          ) / scoredImages.length
        : 70;

    const listingQuality = computeListingQuality({
      photoCount: images.length,
      averageImageQuality: avgQuality,
      name: suggestion.name,
      description: suggestion.description,
      categoryName: suggestion.categoryName,
      brandName: suggestion.brandName,
      hasWeightOrDimensions: !!(suggestion.weight || suggestion.dimensions),
      hasBarcode: !!(suggestion.barcodeValues?.length),
    });

    const duplicateCandidates = suggestion.name
      ? catalogForContext
          .map((item) => ({
            itemId: item.id,
            name: item.name ?? '',
            similarity: nameSimilarity(suggestion.name!, item.name ?? ''),
          }))
          .filter((c) => c.similarity >= 0.7)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5)
      : [];

    return {
      success: true,
      data: {
        name: suggestion.name,
        categoryName: suggestion.categoryName,
        subCategoryName: suggestion.subCategoryName,
        brandName: suggestion.brandName,
        descriptionSuggestion: suggestion.description,
        price: suggestion.price ?? undefined,
        currency: suggestion.currency || currency || 'XAF',
        barcodeValues: suggestion.barcodeValues ?? undefined,
        weight: suggestion.weight ?? undefined,
        weightUnit: suggestion.weightUnit ?? undefined,
        dimensions: suggestion.dimensions ?? undefined,
        isSizeRequired: suggestion.isSizeRequired ?? false,
        isUsed: suggestion.isUsed ?? undefined,
        isFoodItem: suggestion.isFoodItem ?? undefined,
        confidence: suggestion.confidence,
        categoryAlternates: suggestion.categoryAlternates ?? [],
        subCategoryAlternates: suggestion.subCategoryAlternates ?? [],
        duplicateCandidates,
        listingQuality,
      },
    };
  }

  @Post('item-refinement-suggestions')
  @ApiOperation({
    summary:
      'Get AI refinement suggestions for an existing item using images and current fields',
  })
  @ApiBody({ type: ItemRefinementDto })
  @ApiResponse({
    status: 200,
    description: 'Refinement suggestions generated successfully',
  })
  @ApiResponse({ status: 400, description: 'Item has no images or invalid body' })
  async getItemRefinementSuggestions(@ReqContext() ctx: RequestContext, @Body() body: ItemRefinementDto) {
    const user = await this.hasuraUserService.getUser(ctx);
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    if (!body?.itemId) {
      throw new HttpException(
        { success: false, error: 'itemId is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    let item: Awaited<
      ReturnType<BusinessItemsService['getSingleItem']>
    >;
    try {
      item = await this.businessItemsService.getSingleItem(
        businessId,
        body.itemId
      );
    } catch {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }

    const sortedImages = [...(item.item_images ?? [])].sort((a, b) => {
      const main = (x: { image_type?: string }) =>
        x.image_type === 'main' ? 0 : 1;
      const diff = main(a) - main(b);
      if (diff !== 0) {
        return diff;
      }
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });

    const imageUrls = sortedImages
      .map((img: { image_url?: string }) => img.image_url)
      .filter((url): url is string => Boolean(url))
      .slice(0, 8);

    if (imageUrls.length === 0) {
      throw new HttpException(
        {
          success: false,
          error: 'Item must have at least one image to refine with AI',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const itemSnapshot = this.buildItemRefinementSnapshot(
      item as Record<string, unknown>
    );

    const suggestion = await this.aiService.generateItemRefinementSuggestions({
      itemSnapshot,
      imageUrls,
      preferredLanguage: user?.preferred_language ?? 'en',
    });

    return {
      success: true,
      data: {
        name: suggestion.name,
        categoryName: suggestion.categoryName,
        subCategoryName: suggestion.subCategoryName,
        brandName: suggestion.brandName,
        descriptionSuggestion: suggestion.description,
        sku: suggestion.sku,
        model: suggestion.model,
        color: suggestion.color,
        suggestedTagsEn: suggestion.suggestedTagsEn ?? undefined,
        suggestedTagsFr: suggestion.suggestedTagsFr ?? undefined,
        barcodeValues: suggestion.barcodeValues ?? undefined,
        weight: suggestion.weight ?? undefined,
        weightUnit: suggestion.weightUnit ?? undefined,
        dimensions: suggestion.dimensions ?? undefined,
        isFragile: suggestion.isFragile ?? undefined,
        isPerishable: suggestion.isPerishable ?? undefined,
        isUsed: suggestion.isUsed ?? undefined,
        requiresSpecialHandling:
          suggestion.requiresSpecialHandling ?? undefined,
        minOrderQuantity: suggestion.minOrderQuantity ?? undefined,
        maxOrderQuantity: suggestion.maxOrderQuantity ?? undefined,
        price: item.price,
        currency: item.currency,
      },
    };
  }

  @Post('variant-suggestions')
  @ApiOperation({
    summary:
      'Get AI suggestions for a new variant using parent catalog fields and variant photos',
  })
  @ApiBody({ type: VariantSuggestionsDto })
  @ApiResponse({
    status: 200,
    description: 'Variant suggestions generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing variant images or invalid body',
  })
  async getVariantSuggestions(
    @ReqContext() ctx: RequestContext,
    @Body() body: VariantSuggestionsDto
  ) {
    const user = await this.hasuraUserService.getUser(ctx);
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    if (!body?.itemId) {
      throw new HttpException(
        { success: false, error: 'itemId is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    const imageIds = sanitizeVariantImageIds(body.imageIds);
    if (!imageIds.length) {
      throw new HttpException(
        {
          success: false,
          error: 'At least one variant image is required',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    let item: Awaited<ReturnType<BusinessItemsService['getSingleItem']>>;
    try {
      item = await this.businessItemsService.getSingleItem(
        businessId,
        body.itemId
      );
    } catch {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }

    const images = await Promise.all(
      imageIds.map((id) =>
        this.businessImagesService.getImageForBusiness(businessId, id)
      )
    );
    if (images.some((img) => !img)) {
      throw new HttpException(
        { success: false, error: 'One or more images not found' },
        HttpStatus.NOT_FOUND
      );
    }

    const imageUrls = images
      .map((img) => img!.image_url)
      .filter((url): url is string => Boolean(url));
    if (!imageUrls.length) {
      throw new HttpException(
        {
          success: false,
          error: 'Variant images must have valid URLs',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const parentSnapshot = buildVariantParentSnapshot(
      item as Record<string, unknown>
    );
    const suggestion = await this.aiService.generateVariantSuggestions({
      parentSnapshot,
      imageUrls,
      preferredLanguage: user?.preferred_language ?? 'en',
    });

    return {
      success: true,
      data: {
        name: suggestion.name,
        color: suggestion.color,
        sku: suggestion.sku,
        price: suggestion.price ?? item.price,
        currency: suggestion.currency ?? item.currency,
        weight: suggestion.weight ?? item.weight ?? undefined,
        weightUnit: suggestion.weightUnit ?? item.weight_unit ?? undefined,
        dimensions: suggestion.dimensions ?? item.dimensions ?? undefined,
      },
    };
  }

  private buildItemRefinementSnapshot(item: Record<string, unknown>): Record<
    string,
    unknown
  > {
    const row = item as {
      name?: string;
      description?: string;
      sku?: string;
      model?: string;
      color?: string;
      weight?: number | null;
      weight_unit?: string | null;
      dimensions?: string | null;
      price?: number;
      currency?: string;
      is_fragile?: boolean;
      is_perishable?: boolean;
      is_used?: boolean;
      requires_special_handling?: boolean;
      min_order_quantity?: number;
      max_order_quantity?: number | null;
      item_sub_category?: {
        name?: string;
        item_category?: { name?: string };
      } | null;
      brand?: { name?: string } | null;
      item_images?: Array<{
        image_type?: string;
        alt_text?: string | null;
        caption?: string | null;
      }>;
      item_tags?: Array<{ tag?: { name?: string } }>;
    };

    return {
      locked_price_do_not_change: row.price,
      locked_currency_do_not_change: row.currency,
      name: row.name,
      description: row.description,
      sku: row.sku,
      model: row.model,
      color: row.color,
      weight: row.weight,
      weight_unit: row.weight_unit,
      dimensions: row.dimensions,
      category: row.item_sub_category?.item_category?.name ?? null,
      subcategory: row.item_sub_category?.name ?? null,
      brand: row.brand?.name ?? null,
      is_fragile: row.is_fragile,
      is_perishable: row.is_perishable,
      is_used: row.is_used,
      requires_special_handling: row.requires_special_handling,
      min_order_quantity: row.min_order_quantity,
      max_order_quantity: row.max_order_quantity,
      existing_tags: (row.item_tags ?? [])
        .map((it) => it?.tag?.name)
        .filter((n): n is string => typeof n === 'string' && !!n.trim()),
      images: (row.item_images ?? []).map((img) => ({
        image_type: img.image_type,
        alt_text: img.alt_text,
        caption: img.caption,
      })),
    };
  }
}
