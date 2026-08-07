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
import { randomUUID } from 'node:crypto';
import { RENDASUA_PLATFORM_HEADER } from '../agents/agent-location-claim.util';
import { Public } from '../auth/public.decorator';
import { resolveTrackViewerFromRequest } from '../tracking/resolve-track-viewer';
import { TrackAddToCartDto } from './dto/track-add-to-cart.dto';
import { MetaConversionsService } from './meta-conversions.service';
import { resolveMetaActionSource } from './resolve-meta-action-source.util';

@ApiTags('meta-conversions')
@Controller()
export class MetaConversionsTrackController {
  constructor(private readonly meta: MetaConversionsService) {}

  @Public()
  @Post('track-add-to-cart')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Track AddToCart for Meta Conversions API' })
  @ApiResponse({ status: 201, description: 'Event accepted' })
  async trackAddToCart(
    @Body() body: TrackAddToCartDto,
    @Request() req: any,
    @Headers(RENDASUA_PLATFORM_HEADER) platform?: string
  ) {
    const { viewerId, jwtVerified } = resolveTrackViewerFromRequest(req);
    const ua = req.headers?.['user-agent'];
    void this.meta.trackAddToCartSafe({
      eventId: body.eventId?.trim() || randomUUID(),
      actionSource: resolveMetaActionSource(platform),
      inventoryItemId: body.inventoryItemId,
      quantity: body.quantity ?? 1,
      value: body.value,
      currency: body.currency,
      contentName: body.contentName,
      contentCategory: body.contentCategory,
      externalId: viewerId,
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
