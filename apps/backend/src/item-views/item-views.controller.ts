import {
  Body,
  Controller,
  Headers,
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
import { RENDASUA_PLATFORM_HEADER } from '../agents/agent-location-claim.util';
import { Public } from '../auth/public.decorator';
import { resolveMetaActionSource } from '../meta-conversions/resolve-meta-action-source.util';
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
    @Request() req: any,
    @Headers(RENDASUA_PLATFORM_HEADER) platform?: string
  ) {
    const { viewerType, viewerId, jwtVerified } =
      resolveTrackViewerFromRequest(req);
    const ua = req.headers?.['user-agent'];
    await this.itemViewsService.trackView(body.itemId, viewerType, viewerId, {
      eventId: body.eventId,
      value: body.value,
      currency: body.currency,
      contentName: body.contentName,
      actionSource: resolveMetaActionSource(platform),
      clientIpAddress: req.ip,
      clientUserAgent: typeof ua === 'string' ? ua : undefined,
      fbc: body.fbc,
      fbp: body.fbp,
      eventSourceUrl: body.eventSourceUrl,
      allowUserEnrichment: jwtVerified,
    });
    return { success: true };
  }
}
