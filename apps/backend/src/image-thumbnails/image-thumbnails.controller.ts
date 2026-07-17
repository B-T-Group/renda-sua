import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { BackfillThumbnailsDto } from './dto/process-thumbnail.dto';
import { ImageThumbnailsService } from './image-thumbnails.service';
import {
  THUMBNAIL_TABLES,
  ThumbnailSourceType,
} from './image-thumbnails.types';

const DEFAULT_BACKFILL_LIMIT = 200;
const MAX_BACKFILL_LIMIT = 500;

@ApiTags('image-thumbnails')
@Controller('admin/image-thumbnails')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class ImageThumbnailsController {
  constructor(private readonly thumbnailsService: ImageThumbnailsService) {}

  @Post(':sourceType/:id/regenerate')
  @ApiOperation({ summary: 'Reset and asynchronously regenerate one thumbnail' })
  @ApiParam({
    name: 'sourceType',
    enum: ['item_image', 'rental_item_image', 'item_variant_image'],
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Regeneration queued' })
  async regenerate(
    @Param('sourceType') sourceType: string,
    @Param('id') id: string
  ) {
    const source = this.parseSourceType(sourceType);
    const data = await this.thumbnailsService.regenerate(source, id);
    return { success: true, data };
  }

  @Post('backfill')
  @ApiOperation({
    summary: 'Queue thumbnail generation for images missing one (async batch)',
  })
  @ApiBody({ type: BackfillThumbnailsDto })
  @ApiResponse({
    status: 201,
    description: 'Batch queued with next per-source-type cursors',
  })
  async backfill(@Body() body: BackfillThumbnailsDto) {
    const data = await this.thumbnailsService.backfill(
      this.parseSourceTypes(body?.sourceTypes),
      this.parseLimit(body?.limit),
      body?.cursors
    );
    return { success: true, data };
  }

  @Post('retry-failed')
  @ApiOperation({ summary: 'Queue retries for failed thumbnails (async batch)' })
  @ApiBody({ type: BackfillThumbnailsDto })
  @ApiResponse({
    status: 201,
    description: 'Batch queued with next per-source-type cursors',
  })
  async retryFailed(@Body() body: BackfillThumbnailsDto) {
    const data = await this.thumbnailsService.backfill(
      this.parseSourceTypes(body?.sourceTypes),
      this.parseLimit(body?.limit),
      body?.cursors,
      ['failed']
    );
    return { success: true, data };
  }

  private parseSourceType(value: string): ThumbnailSourceType {
    if (!THUMBNAIL_TABLES[value as ThumbnailSourceType]) {
      throw new BadRequestException(`Invalid sourceType: ${value}`);
    }
    return value as ThumbnailSourceType;
  }

  private parseSourceTypes(values?: string[]): ThumbnailSourceType[] {
    if (!values?.length) {
      return Object.keys(THUMBNAIL_TABLES) as ThumbnailSourceType[];
    }
    return values.map((v) => this.parseSourceType(v));
  }

  private parseLimit(limit?: number): number {
    const parsed = Number(limit) || DEFAULT_BACKFILL_LIMIT;
    return Math.min(Math.max(parsed, 1), MAX_BACKFILL_LIMIT);
  }
}
