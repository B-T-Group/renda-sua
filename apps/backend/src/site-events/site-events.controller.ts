import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { resolveTrackViewerFromRequest } from '../tracking/resolve-track-viewer';
import { TrackSiteEventDto } from './dto/track-site-event.dto';
import { SiteEventsService } from './site-events.service';

@ApiTags('site-events')
@Controller()
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
  })
)
export class SiteEventsController {
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
    const viewer = resolveTrackViewerFromRequest(req);
    await this.siteEventsService.trackEvent(body, viewer);
    return { success: true };
  }
}
