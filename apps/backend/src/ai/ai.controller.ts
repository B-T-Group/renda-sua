import {
  Body,
  Controller,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
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
import { HasuraUserService } from '../hasura/hasura-user.service';
import { BusinessImagesService } from '../business-images/business-images.service';
import { BusinessItemsService } from '../business-items/business-items.service';
import { ItemRefinementDto } from './dto/item-refinement.dto';

@ApiTags('ai')
@Controller('ai')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly businessImagesService: BusinessImagesService,
    @Inject(forwardRef(() => BusinessItemsService))
    private readonly businessItemsService: BusinessItemsService
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
  @ApiBody({
    schema: {
      type: 'object',
      required: ['imageId'],
      properties: {
        imageId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Suggestions generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            categoryName: { type: 'string' },
            subCategoryName: { type: 'string' },
            brandName: { type: 'string' },
            descriptionSuggestion: { type: 'string' },
            price: { type: 'number' },
            currency: { type: 'string' },
            barcodeValues: { type: 'array', items: { type: 'string' } },
            weight: { type: 'number' },
            weightUnit: { type: 'string' },
            dimensions: { type: 'string' },
          },
        },
      },
    },
  })
  async getImageItemSuggestions(@Body() body: { imageId: string }) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    if (!body?.imageId) {
      throw new HttpException(
        { success: false, error: 'imageId is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    const image = await this.businessImagesService.getImageForBusiness(
      businessId,
      body.imageId
    );

    const suggestion = await this.aiService.generateImageItemSuggestions({
      imageUrl: image.image_url,
      caption: image.caption,
      altText: image.alt_text,
      defaultCurrency: 'XAF',
      preferredLanguage: user?.preferred_language ?? 'en',
    });

    if (suggestion.barcodeValues?.length) {
      await this.businessImagesService.storeBarcodeValuesOnImage(
        businessId,
        image.id,
        suggestion.barcodeValues
      );
    }

    return {
      success: true,
      data: {
        name: suggestion.name,
        categoryName: suggestion.categoryName,
        subCategoryName: suggestion.subCategoryName,
        brandName: suggestion.brandName,
        descriptionSuggestion: suggestion.description,
        price: suggestion.price ?? undefined,
        currency: suggestion.currency || 'XAF',
        barcodeValues: suggestion.barcodeValues ?? undefined,
        weight: suggestion.weight ?? undefined,
        weightUnit: suggestion.weightUnit ?? undefined,
        dimensions: suggestion.dimensions ?? undefined,
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
  async getItemRefinementSuggestions(@Body() body: ItemRefinementDto) {
    const user = await this.hasuraUserService.getUser();
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
        requiresSpecialHandling:
          suggestion.requiresSpecialHandling ?? undefined,
        minOrderQuantity: suggestion.minOrderQuantity ?? undefined,
        maxOrderQuantity: suggestion.maxOrderQuantity ?? undefined,
        price: item.price,
        currency: item.currency,
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
