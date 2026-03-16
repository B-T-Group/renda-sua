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
import { HasuraUserService } from '../hasura/hasura-user.service';
import { BusinessImagesService } from '../business-images/business-images.service';

@ApiTags('ai')
@Controller('ai')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly businessImagesService: BusinessImagesService
  ) {}

  @Post('generate-description')
  @ApiOperation({
    summary: 'Generate AI-powered product description',
    description:
      'Generate a compelling product description using OpenAI GPT-3.5-turbo based on product details',
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
    description: 'Too Many Requests - OpenAI API rate limit exceeded',
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
        error: { type: 'string', example: 'OpenAI API error' },
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
    });

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
      },
    };
  }
}
