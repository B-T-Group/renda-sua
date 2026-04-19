import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { resolveTrackViewerFromRequest } from '../tracking/resolve-track-viewer';
import { TrackSiteEventDto } from './dto/track-site-event.dto';
import { isLikelyAutomatedSiteEventClient } from './site-event-bot.util';
import { SiteEventsService } from './site-events.service';

@ApiTags('site-events')
@Controller()
@Throttle({ short: { limit: 45, ttl: 60000 } })
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
  })
)
export class SiteEventsController {
  private readonly logger = new Logger(SiteEventsController.name);

  constructor(private readonly siteEventsService: SiteEventsService) {}

  @Public()
  @Post('track-site-event')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record an append-only site analytics event' })
  @ApiBody({ type: TrackSiteEventDto })
  @ApiResponse({
    status: 201,
    description: 'Event accepted',
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payload',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string' },
      },
    },
  })
  async trackSiteEvent(@Body() body: TrackSiteEventDto, @Request() req: any) {
    const rawUa = req.headers?.['user-agent'];
    const uaStr = Array.isArray(rawUa) ? rawUa[0] : rawUa;
    if (isLikelyAutomatedSiteEventClient(uaStr)) {
      this.logger.debug('site_event skipped (likely automated client)');
      return { success: true };
    }
    const viewer = resolveTrackViewerFromRequest(req);
    await this.siteEventsService.trackEvent(body, viewer);
    return { success: true };
  }
}
