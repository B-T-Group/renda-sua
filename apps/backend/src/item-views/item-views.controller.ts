import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { resolveTrackViewerFromRequest } from '../tracking/resolve-track-viewer';
import { TrackItemViewDto } from './dto/track-item-view.dto';
import { ItemViewsService } from './item-views.service';

@ApiTags('item-views')
@Controller()
export class ItemViewsController {
  constructor(private readonly itemViewsService: ItemViewsService) {}

  @Public()
  @Post('track-view')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Track a unique view for an inventory item' })
  @ApiResponse({
    status: 201,
    description: 'View tracked successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid payload',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid itemId' },
      },
    },
  })
  async trackView(
    @Body() body: TrackItemViewDto,
    @Request() req: any
  ) {
    const itemId = body.itemId;
    const { viewerType, viewerId } = resolveTrackViewerFromRequest(req);

    await this.itemViewsService.trackView(itemId, viewerType, viewerId);

    return {
      success: true,
    };
  }
}

