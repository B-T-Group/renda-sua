import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminPerformanceService } from './admin-performance.service';
import {
  AdminPerformanceSummaryQueryDto,
  AdminPerformanceTopAgentsQueryDto,
} from './dto/admin-performance-query.dto';

const QUERY_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@ApiTags('admin-performance')
@Controller('admin/performance')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.DASHBOARD_PLATFORM_STATS)
@UsePipes(QUERY_PIPE)
@ApiBearerAuth()
export class AdminPerformanceController {
  constructor(
    private readonly adminPerformanceService: AdminPerformanceService
  ) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Platform growth counts (businesses, clients, agents, sale/rental items) by market and date window',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated enrollment and catalog counts for the window',
  })
  async summary(@Query() query: AdminPerformanceSummaryQueryDto) {
    this.assertDateRange(query);
    return this.adminPerformanceService.getSummary({
      from: query.from,
      to: query.to,
      countryCode: query.countryCode,
    });
  }

  @Get('top-agents')
  @ApiOperation({
    summary:
      'Top performing agents by completed deliveries or business referrals',
  })
  @ApiResponse({
    status: 200,
    description: 'Ranked agents with counts for the selected metric',
  })
  async topAgents(@Query() query: AdminPerformanceTopAgentsQueryDto) {
    this.assertDateRange(query);
    const agents = await this.adminPerformanceService.getTopAgents(
      { from: query.from, to: query.to, countryCode: query.countryCode },
      query.metric,
      query.limit ?? 10
    );
    return { metric: query.metric, agents };
  }

  @Get('markets')
  @ApiOperation({ summary: 'Supported markets (countries) for filtering' })
  @ApiResponse({ status: 200, description: 'Distinct supported countries' })
  async markets() {
    return { markets: await this.adminPerformanceService.getMarkets() };
  }

  private assertDateRange(query: AdminPerformanceSummaryQueryDto): void {
    if (new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('from must be before to');
    }
  }
}
