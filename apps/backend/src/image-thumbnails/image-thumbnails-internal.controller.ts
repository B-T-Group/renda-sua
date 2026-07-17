import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { ImageThumbnailsService } from './image-thumbnails.service';
import { ProcessThumbnailDto } from './dto/process-thumbnail.dto';
import { THUMBNAIL_TABLES } from './image-thumbnails.types';

@ApiTags('Image thumbnails (internal)')
@Controller('internal/image-thumbnails')
export class ImageThumbnailsInternalController {
  constructor(
    private readonly thumbnailsService: ImageThumbnailsService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post('process')
  @ApiOperation({ summary: 'Internal: generate a thumbnail for one image' })
  @ApiBody({ type: ProcessThumbnailDto })
  @ApiResponse({ status: 200, description: 'Processed (or already claimed)' })
  @ApiResponse({ status: 401, description: 'Invalid internal key' })
  async process(
    @Body() body: ProcessThumbnailDto,
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    this.assertValidSource(body);
    return this.thumbnailsService.processOne(body.sourceType, body.imageId);
  }

  private assertValidSource(body: ProcessThumbnailDto): void {
    if (!body?.imageId || !THUMBNAIL_TABLES[body?.sourceType]) {
      throw new BadRequestException('sourceType and imageId are required');
    }
  }

  private assertInternalKey(internalKey?: string): void {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
  }
}
