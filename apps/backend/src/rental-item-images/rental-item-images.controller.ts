import {
  BadRequestException,
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
  Query,
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
import { AiService } from '../ai/ai.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CreateRentalFromImageDto } from './dto/create-rental-from-image.dto';
import { RentalFromImageSuggestionsDto } from './dto/rental-from-image-suggestions.dto';
import { RentalItemImagesService } from './rental-item-images.service';
import type {
  CreateRentalItemImageInput,
  UpdateRentalItemImageInput,
} from './rental-item-images.service';

interface BulkCreateBody {
  rental_category_id?: string | null;
  images: CreateRentalItemImageInput[];
}

@ApiTags('rental-item-images')
@Controller('rental-item-images')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class RentalItemImagesController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly rentalItemImagesService: RentalItemImagesService,
    private readonly aiService: AiService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List rental item images (library) for the current business',
  })
  @ApiResponse({ status: 200, description: 'Images retrieved' })
  @ApiResponse({ status: 403, description: 'User has no business' })
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('rental_category_id') rentalCategoryId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string
  ) {
    const businessId = await this.requireBusinessId();
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSizeNumber = Math.min(
      Math.max(parseInt(pageSize, 10) || 20, 1),
      100
    );
    const result = await this.rentalItemImagesService.getRentalItemImages(
      businessId,
      {
        page: pageNumber,
        pageSize: pageSizeNumber,
        rentalCategoryId: rentalCategoryId || undefined,
        status: status || undefined,
        search: search || undefined,
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

  @Get('rental-items/search')
  @ApiOperation({
    summary: 'Search rental items by name for association autocomplete',
  })
  @ApiResponse({ status: 200, description: 'Items retrieved' })
  async searchRentalItems(@Query('q') q: string) {
    const businessId = await this.requireBusinessId();
    const items = await this.rentalItemImagesService.searchRentalItems(
      businessId,
      q || '',
      10
    );
    return { success: true, data: { items } };
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk add images to the rental image library (S3 or URL)',
  })
  @ApiResponse({ status: 200, description: 'Created' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        rental_category_id: { type: 'string', format: 'uuid', nullable: true },
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
    const businessId = await this.requireBusinessId();
    const images = body.images ?? [];
    if (!images.length) {
      throw new HttpException(
        { success: false, error: 'No images provided' },
        HttpStatus.BAD_REQUEST
      );
    }
    const created = await this.rentalItemImagesService.bulkCreate(
      businessId,
      body.rental_category_id ?? null,
      images
    );
    return {
      success: true,
      data: { images: created.map((r) => ({ id: r.id })) },
    };
  }

  @Post('rental-from-image-suggestions')
  @ApiOperation({
    summary:
      'Analyze the library image with AI and return suggested rental fields (for manual review)',
  })
  @ApiResponse({ status: 200, description: 'Suggestions returned' })
  @ApiResponse({ status: 400, description: 'Image already linked' })
  @ApiBody({ type: RentalFromImageSuggestionsDto })
  async rentalFromImageSuggestions(@Body() body: RentalFromImageSuggestionsDto) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const data =
      await this.rentalItemImagesService.getRentalFromImageSuggestions(
        businessId,
        body.imageId,
        user?.preferred_language ?? 'en'
      );
    return { success: true, data };
  }

  @Post('create-rental-from-image')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a rental item and link the image. mode=manual uses body fields; mode=ai infers from the image (optional overrides).',
  })
  @ApiResponse({ status: 201, description: 'Rental item created' })
  @ApiResponse({ status: 400, description: 'Image already linked or invalid mode data' })
  @ApiBody({ type: CreateRentalFromImageDto })
  async createRentalFromImage(@Body() body: CreateRentalFromImageDto) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    const item = await this.rentalItemImagesService.createRentalFromImage(
      businessId,
      body,
      user?.preferred_language ?? 'en'
    );
    return { success: true, data: { item } };
  }

  @Post(':id/associate-rental-item')
  @ApiOperation({ summary: 'Link a library image to an existing rental item' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { rental_item_id: { type: 'string', format: 'uuid' } },
      required: ['rental_item_id'],
    },
  })
  async associate(
    @Param('id') id: string,
    @Body() body: { rental_item_id: string }
  ) {
    const businessId = await this.requireBusinessId();
    await this.rentalItemImagesService.associateRentalItem(
      businessId,
      id,
      body.rental_item_id
    );
    return { success: true };
  }

  @Post(':id/disassociate-rental-item')
  @ApiOperation({
    summary: 'Unlink image from rental item (keeps row in library)',
  })
  async disassociate(@Param('id') id: string) {
    const businessId = await this.requireBusinessId();
    await this.rentalItemImagesService.disassociateRentalItem(
      businessId,
      id
    );
    return { success: true };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update rental library image metadata or URL' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        rental_category_id: { type: 'string', format: 'uuid', nullable: true },
        image_url: { type: 'string' },
        s3_key: { type: 'string', nullable: true },
        file_size: { type: 'number', nullable: true },
        width: { type: 'number', nullable: true },
        height: { type: 'number', nullable: true },
        format: { type: 'string', nullable: true },
        caption: { type: 'string', nullable: true },
        alt_text: { type: 'string', nullable: true },
        tags: { type: 'array', items: { type: 'string' }, nullable: true },
        status: { type: 'string', nullable: true },
        is_ai_cleaned: { type: 'boolean', nullable: true },
        display_order: { type: 'number', nullable: true },
      },
    },
  })
  async patch(
    @Param('id') id: string,
    @Body() body: UpdateRentalItemImageInput
  ) {
    const businessId = await this.requireBusinessId();
    const image = await this.rentalItemImagesService.updateImage(
      businessId,
      id,
      body
    );
    return { success: true, data: { image } };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a rental library image' })
  async remove(@Param('id') id: string) {
    const businessId = await this.requireBusinessId();
    await this.rentalItemImagesService.deleteImage(businessId, id);
    return { success: true };
  }

  @Post(':id/cleanup')
  @ApiOperation({
    summary: 'AI cleanup preview (base64); accept by PATCH with new URL + is_ai_cleaned',
  })
  @ApiResponse({ status: 200, description: 'Returns b64_json for preview' })
  async cleanup(@Param('id') id: string) {
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
    const image = await this.rentalItemImagesService.getImageForBusiness(
      businessId,
      id
    );
    if (image.is_ai_cleaned) {
      throw new BadRequestException('Image was already cleaned with AI');
    }
    const result = await this.aiService.cleanupProductImage(image.image_url);
    return { success: true, data: result };
  }

  private async requireBusinessId(): Promise<string> {
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
