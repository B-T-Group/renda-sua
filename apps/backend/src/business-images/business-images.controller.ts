import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AiService } from '../ai/ai.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { BusinessImagesService, CreateBusinessImageInput } from './business-images.service';
import type { UpdateBusinessImageInput } from './business-images.service';

interface BulkCreateBody {
  sub_category_id?: number | null;
  images: CreateBusinessImageInput[];
}

@ApiTags('business-images')
@Controller('business-images')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BusinessImagesController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly businessImagesService: BusinessImagesService,
    private readonly aiService: AiService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get paginated business images for the current business',
  })
  @ApiResponse({ status: 200, description: 'Images retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async getImages(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('sub_category_id') subCategoryId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string
  ) {
    const businessId = await this.getBusinessIdOrThrow();
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSizeNumber = Math.min(
      Math.max(parseInt(pageSize, 10) || 20, 1),
      100
    );
    const subCategory =
      subCategoryId != null ? parseInt(subCategoryId, 10) : undefined;
    const result = await this.businessImagesService.getBusinessImages(
      businessId,
      {
        page: pageNumber,
        pageSize: pageSizeNumber,
        subCategoryId: Number.isNaN(subCategory as number)
          ? undefined
          : subCategory,
        status,
        search,
      }
    );
    return {
      success: true,
      data: {
        images: result.images,
        total: result.total,
        page: pageNumber,
        pageSize: pageSizeNumber,
      },
    };
  }

  @Post('bulk')
  @ApiOperation({
    summary:
      'Bulk create business images for the current business (S3 or URL-only)',
  })
  @ApiResponse({ status: 200, description: 'Images created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid body' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sub_category_id: { type: 'integer', nullable: true },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              image_url: { type: 'string' },
              s3_key: { type: 'string', nullable: true },
              file_size: { type: 'number', nullable: true },
              width: { type: 'number', nullable: true },
              height: { type: 'number', nullable: true },
              format: { type: 'string', nullable: true },
              caption: { type: 'string', nullable: true },
              alt_text: { type: 'string', nullable: true },
            },
            required: ['image_url'],
          },
        },
      },
      required: ['images'],
    },
  })
  async bulkCreate(@Body() body: BulkCreateBody) {
    const businessId = await this.getBusinessIdOrThrow();
    const images = body.images ?? [];
    if (!images.length) {
      throw new HttpException(
        { success: false, error: 'No images provided' },
        HttpStatus.BAD_REQUEST
      );
    }
    const subCategoryId =
      body.sub_category_id === undefined ? null : body.sub_category_id;
    await this.businessImagesService.bulkCreateBusinessImages(
      businessId,
      subCategoryId,
      images
    );
    return { success: true };
  }

  @Post(':id/associate-item')
  @ApiOperation({
    summary:
      'Associate a business image with an item by tagging it with the item SKU',
  })
  @ApiResponse({ status: 200, description: 'Image associated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid SKU' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sku: { type: 'string' },
      },
      required: ['sku'],
    },
  })
  async associateImageToItem(
    @Param('id') id: string,
    @Body() body: { sku: string }
  ) {
    const businessId = await this.getBusinessIdOrThrow();
    await this.businessImagesService.associateImageToItem(
      businessId,
      id,
      body.sku
    );
    return { success: true };
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update properties of a business image (caption, alt_text, metadata, or URL/S3 key)',
  })
  @ApiResponse({ status: 200, description: 'Image updated successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sub_category_id: { type: 'integer', nullable: true },
        image_url: { type: 'string' },
        s3_key: { type: 'string', nullable: true },
        file_size: { type: 'number', nullable: true },
        width: { type: 'number', nullable: true },
        height: { type: 'number', nullable: true },
        format: { type: 'string', nullable: true },
        caption: { type: 'string', nullable: true },
        alt_text: { type: 'string', nullable: true },
        tags: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
        status: { type: 'string', nullable: true },
      },
    },
  })
  async updateImage(
    @Param('id') id: string,
    @Body() body: UpdateBusinessImageInput
  ) {
    const businessId = await this.getBusinessIdOrThrow();
    const image = await this.businessImagesService.updateBusinessImage(
      businessId,
      id,
      body
    );
    return { success: true, data: { image } };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a business image' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async deleteImage(@Param('id') id: string) {
    const businessId = await this.getBusinessIdOrThrow();
    await this.businessImagesService.deleteBusinessImage(businessId, id);
    return { success: true };
  }

  @Post(':id/remove-tag')
  @ApiOperation({
    summary: 'Remove a tag from a business image (e.g. unassociate from item)',
  })
  @ApiResponse({ status: 200, description: 'Tag removed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid tag' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { tag: { type: 'string' } },
      required: ['tag'],
    },
  })
  async removeTag(
    @Param('id') id: string,
    @Body() body: { tag: string }
  ) {
    const businessId = await this.getBusinessIdOrThrow();
    const tag = body?.tag?.trim();
    if (!tag) {
      throw new HttpException(
        { success: false, error: 'Tag is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    await this.businessImagesService.removeTagFromImage(businessId, id, tag);
    return { success: true };
  }

  @Post(':id/cleanup')
  @ApiOperation({
    summary:
      'Clean up a business image using AI (e.g. nicer background). Returns base64 image for preview.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleaned image returned as base64',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { b64_json: { type: 'string' } },
          required: ['b64_json'],
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description:
      'User has no business or image cleanup is not enabled for this business',
  })
  @ApiResponse({ status: 404, description: 'Image not found' })
  @ApiResponse({ status: 429, description: 'OpenAI rate limit exceeded' })
  async cleanupImage(@Param('id') id: string) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    if (!user.business?.image_cleanup_enabled) {
      throw new HttpException(
        {
          success: false,
          error: 'Image cleanup is not enabled for this business account',
        },
        HttpStatus.FORBIDDEN
      );
    }
    const image = await this.businessImagesService.getImageForBusiness(
      businessId,
      id
    );
    const result = await this.aiService.cleanupProductImage(image.image_url);
    return { success: true, data: result };
  }

  @Get('item-search')
  @ApiOperation({
    summary:
      'Search items for the current business by name or SKU (for image association autocomplete)',
  })
  @ApiResponse({ status: 200, description: 'Items retrieved successfully' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async searchItems(@Query('q') q: string) {
    const businessId = await this.getBusinessIdOrThrow();
    const results = await this.businessImagesService.searchItems(
      businessId,
      q || '',
      10
    );
    return { success: true, data: { items: results } };
  }

  private async getBusinessIdOrThrow(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    return businessId;
  }
}

