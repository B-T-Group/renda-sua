import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { AdminAuthGuard } from './admin-auth.guard';
import { BusinessReferralReviewService } from './business-referral-review.service';
import {
  BusinessReferralReviewQueueQueryDto,
  SubmitBusinessReferralReviewDto,
} from './dto/business-referral-review.dto';

const PIPE = new ValidationPipe({ transform: true, whitelist: true });

@ApiTags('admin-business-referral-reviews')
@Controller('admin/business-referral-reviews')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.DASHBOARD_PLATFORM_STATS)
@UsePipes(PIPE)
@ApiBearerAuth()
export class BusinessReferralReviewController {
  constructor(
    private readonly reviewService: BusinessReferralReviewService
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List business referrals eligible for payout quality review (or by status)',
  })
  @ApiResponse({ status: 200, description: 'Paginated review queue' })
  async list(@Query() query: BusinessReferralReviewQueueQueryDto) {
    return this.reviewService.listQueue({
      status: query.status ?? 'pending',
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get(':businessId')
  @ApiOperation({
    summary:
      'Full referral review detail: business, agent, items with images and marks',
  })
  @ApiParam({ name: 'businessId', type: String })
  @ApiResponse({ status: 200, description: 'Review detail payload' })
  @ApiResponse({ status: 404, description: 'Referred business not found' })
  async detail(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.reviewService.getDetail(businessId);
  }

  @Post(':businessId/submit')
  @ApiOperation({
    summary: 'Approve or reject a business referral payout (with item marks)',
  })
  @ApiParam({ name: 'businessId', type: String })
  @ApiResponse({ status: 200, description: 'Review saved' })
  @ApiResponse({ status: 409, description: 'Already paid — locked' })
  async submit(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: SubmitBusinessReferralReviewDto,
    @Req() request: { user: { id: string } }
  ) {
    return this.reviewService.submit(businessId, request.user.id, body);
  }
}
