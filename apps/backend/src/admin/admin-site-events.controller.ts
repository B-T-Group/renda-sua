import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminSiteEventsQueryDto } from './dto/admin-site-events-query.dto';
import { SiteEventsService } from '../site-events/site-events.service';

const QUERY_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@ApiTags('admin-site-events')
@Controller('admin/site-events')
@SkipThrottle()
@UseGuards(AdminAuthGuard)
@UsePipes(QUERY_PIPE)
@ApiBearerAuth()
export class AdminSiteEventsController {
  constructor(private readonly siteEventsService: SiteEventsService) {}

  @Get()
  @ApiOperation({ summary: 'List site analytics events (paginated)' })
  @ApiResponse({ status: 200, description: 'Paged site_events rows' })
  async list(@Query() query: AdminSiteEventsQueryDto) {
    this.assertDateRange(query);
    return this.siteEventsService.listSiteEventsForAdmin({
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      eventType: query.eventType,
      subjectType: query.subjectType,
      subjectId: query.subjectId,
      from: query.from,
      to: query.to,
    });
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Aggregated counts: summaryGroupBy=eventType (default), inventoryItem, or eventAndSubject',
  })
  @ApiResponse({
    status: 200,
    description:
      'Total, breakdown by groupBy, truncation flags (inventory / event+subject)',
  })
  async summary(@Query() query: AdminSiteEventsQueryDto) {
    this.assertDateRange(query);
    return this.siteEventsService.getAdminSiteEventsSummary(
      {
        eventType: query.eventType,
        subjectType: query.subjectType,
        subjectId: query.subjectId,
        from: query.from,
        to: query.to,
      },
      query.summaryGroupBy ?? 'eventType'
    );
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export site events as CSV (warehouse-friendly download)',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV attachment' })
  async exportCsv(
    @Query() query: AdminSiteEventsQueryDto,
    @Res({ passthrough: false }) res: Response
  ) {
    this.assertDateRange(query);
    const csv = await this.siteEventsService.exportSiteEventsCsv({
      eventType: query.eventType,
      subjectType: query.subjectType,
      subjectId: query.subjectId,
      from: query.from,
      to: query.to,
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="site_events_export_${stamp}.csv"`
    );
    res.send('\ufeff' + csv);
  }

  private assertDateRange(query: AdminSiteEventsQueryDto): void {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from must be before or equal to to');
    }
  }
}
