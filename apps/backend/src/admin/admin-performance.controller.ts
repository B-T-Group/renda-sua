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
import { ReferralPayoutPreviewService } from '../business-referral-payouts/referral-payout-preview.service';
import { RepresentativeCompensationService } from '../representative-compensation/representative-compensation.service';
import {
  AdminPayoutPreviewQueryDto,
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
    private readonly adminPerformanceService: AdminPerformanceService,
    private readonly referralPayoutPreviewService: ReferralPayoutPreviewService,
    private readonly representativeCompensationService: RepresentativeCompensationService
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
    description:
      'For business_referrals, each agent includes earnedAmount from credited representative_compensation_events in the selected window, and projectedPayoutAmount from pending events waiting for Saturday credit.',
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
      query.limit ?? 10,
      query.minItemsPerReferral
    );
    return {
      metric: query.metric,
      minItemsPerReferral: query.minItemsPerReferral ?? null,
      agents,
    };
  }

  @Get('payout-preview')
  @ApiOperation({
    summary:
      'Dry-run upcoming Saturday business-referral payouts (no credits). One row per referred business, including pyramid splits.',
  })
  @ApiResponse({
    status: 200,
    description: 'Simulated payout rows and pyramid beneficiaries',
  })
  async payoutPreview(@Query() query: AdminPayoutPreviewQueryDto) {
    return this.referralPayoutPreviewService.previewWeeklyPayouts(
      query.countryCode
    );
  }

  @Get('compensation-events')
  @ApiOperation({
    summary: 'List representative compensation ledger rows (newest first)',
  })
  @ApiResponse({
    status: 200,
    description: 'Compensation events with rule, amount, status, and business',
  })
  async compensationEvents(@Query() query: AdminPayoutPreviewQueryDto) {
    const events = await this.representativeCompensationService.listEvents({
      countryCode: query.countryCode,
      limit: 100,
    });
    return { events };
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
