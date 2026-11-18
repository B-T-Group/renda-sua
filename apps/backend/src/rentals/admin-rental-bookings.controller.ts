import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions, RequireRoles } from '../rbac/permissions.decorator';
import { PlatformPermissions, PlatformRoles } from '../rbac/platform-permissions';
import { IssueRentalStartOverwriteDto } from './dto/issue-rental-start-overwrite.dto';
import { AdjustOvertimeDto, AdminHandbackDto, DecideInspectionDisputeDto } from './dto/rental-inspection.dto';
import { RentalInspectionService } from './inspection/rental-inspection.service';
import { ConfirmReportedReturnDto } from './dto/confirm-reported-return.dto';
import { RentalNotReceivedService } from './inspection/rental-not-received.service';
import { RentalRenterReturnService } from './renter-return/rental-renter-return.service';
import { RentalsService } from './rentals.service';
import { SetDeclineExclusionDto } from './decline-ranking/decline-exclusion.dto';
import { DeclineExclusionService } from './decline-ranking/decline-exclusion.service';
import { MarkDeclineRefundDto } from './pickup-decline/pickup-decline.dto';
import { RentalDeclineCountsService } from './pickup-decline/rental-decline-counts.service';
import { RentalPickupDeclineService } from './pickup-decline/rental-pickup-decline.service';

interface RequestWithUser extends Request {
  user: { id: string };
}

/**
 * Support exception for a confirmed rental whose client cannot show the PIN.
 * The business still types the code; they cannot mint it.
 */
@ApiTags('admin')
@Controller('admin/rentals')
@UseGuards(AdminAuthGuard)
@RequireRoles(
  PlatformRoles.SUPERUSER,
  PlatformRoles.SUPPORT,
  PlatformRoles.ORDER_MANAGER
)
@RequirePermissions(PlatformPermissions.MODERATE_RENTALS)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminRentalBookingsController {
  constructor(
    private readonly rentalsService: RentalsService,
    private readonly inspections: RentalInspectionService,
    private readonly notReceived: RentalNotReceivedService,
    private readonly renterReturns: RentalRenterReturnService,
    private readonly declineCounts: RentalDeclineCountsService,
    private readonly pickupDecline: RentalPickupDeclineService,
    private readonly exclusions: DeclineExclusionService
  ) {}

  @Post('bookings/:id/start-overwrite-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a one-time rental start code (support, reason required)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async issueStartCode(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() body: IssueRentalStartOverwriteDto,
    @Req() req: RequestWithUser
  ) {
    return this.rentalsService.issueStartOverwriteCodeForSupport(
      bookingId,
      req.user.id,
      body.reason
    );
  }

  @Post('bookings/:id/overtime-adjustment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjust derived overtime for an enrolled rental (reason required)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  adjustOvertime(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() body: AdjustOvertimeDto,
    @Req() req: RequestWithUser
  ) {
    return this.rentalsService.adjustEnrolledOvertime(
      bookingId,
      req.user.id,
      body.overtimeAmount,
      body.reason
    );
  }

  @Post('bookings/:id/inspection-handback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record physical handback at server time when the business does not' })
  @ApiParam({ name: 'id', format: 'uuid' })
  handback(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() body: AdminHandbackDto,
    @Req() req: RequestWithUser
  ) {
    return this.inspections.recordHandbackAsAdmin(bookingId, req.user.id, body.reason);
  }

  @Get('inspection-disputes')
  @ApiOperation({ summary: 'Open and escalated rental inspection reviews' })
  listDisputes() {
    return this.inspections.listOpenDisputes();
  }

  @Get('return-reports')
  @ApiOperation({
    summary: 'Open renter return reports. Status and the deposit are unchanged.',
  })
  listReturnReports() {
    return this.renterReturns.listForAdmin();
  }

  @Post('bookings/:id/confirm-reported-return')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Support confirms an escalated renter return through the business confirm or handback path',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  confirmReportedReturn(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() body: ConfirmReportedReturnDto,
    @Req() req: RequestWithUser
  ) {
    return this.renterReturns.confirmAsSupport(bookingId, req.user.id, body.reason);
  }

  @Get('not-received-reports')
  @ApiOperation({
    summary: 'Renter reports that the item was not handed over. The booking is unchanged.',
  })
  listNotReceived() {
    return this.notReceived.listForAdmin();
  }

  @Get('bookings/:id/inspection-case')
  @ApiOperation({ summary: 'Pickup and return reports, photos, and settlement flags' })
  @ApiParam({ name: 'id', format: 'uuid' })
  inspectionCase(@Param('id', ParseUUIDPipe) bookingId: string) {
    return this.inspections.getAdminCase(bookingId);
  }

  @Post('bookings/:id/inspection-decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decide a rental inspection dispute (reason required)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  decide(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() body: DecideInspectionDisputeDto,
    @Req() req: RequestWithUser
  ) {
    return this.inspections.decide(
      bookingId,
      req.user.id,
      body.outcome,
      body.reason,
      body.damageAmount
    );
  }

  @Get('condition-declines')
  @ApiOperation({ summary: 'Parties with condition declines in the last 90 days' })
  @ApiResponse({ status: 200, description: 'Counts, pickup reach, and the 5-decline flag' })
  @ApiResponse({ status: 404, description: 'Pickup decline is off' })
  listConditionDeclines() {
    return this.declineCounts.list();
  }

  @Get('bookings/:id/condition-decline')
  @ApiOperation({ summary: 'Decline reason and private photos for support' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Signed photo URLs' })
  @ApiResponse({ status: 404, description: 'No decline, or the flag is off' })
  conditionDecline(@Param('id', ParseUUIDPipe) bookingId: string) {
    return this.pickupDecline.adminDetail(bookingId);
  }

  @Post('bookings/:id/refund-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a pending Mobile Money refund refunded, failed, or confirmed unpaid' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: MarkDeclineRefundDto })
  @ApiResponse({ status: 200, description: 'Refund status updated' })
  @ApiResponse({ status: 400, description: 'Missing provider reference and note' })
  @ApiResponse({ status: 403, description: 'FINANCIAL_REFUNDS is required' })
  @ApiResponse({ status: 409, description: 'Refund is not pending, or a payout may be in progress' })
  markDeclineRefund(@Param('id', ParseUUIDPipe) bookingId: string, @Body() body: MarkDeclineRefundDto) {
    return this.pickupDecline.markRefund(bookingId, body);
  }

  @Get('condition-exclusions')
  @ApiOperation({ summary: 'Recent declines with the support exclusion toggle' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiResponse({ status: 200, description: 'One page of decline rows and the counts support sees' })
  @ApiResponse({ status: 404, description: 'Decline ranking is off' })
  listDeclineExclusions(@Query('page') page?: string) {
    return this.exclusions.list(Number(page) || 1);
  }

  @Post('bookings/:id/condition-exclusion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a condition decline as not the business fault, or reverse it' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: SetDeclineExclusionDto })
  @ApiResponse({ status: 200, description: 'Exclusion stored and audited' })
  @ApiResponse({ status: 403, description: 'Not a support or admin role' })
  @ApiResponse({ status: 404, description: 'Ranking is off, or there is no decline' })
  @ApiResponse({ status: 409, description: 'The booking has more than one decline and no decline id' })
  setDeclineExclusion(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() body: SetDeclineExclusionDto,
    @Req() req: RequestWithUser
  ) {
    return this.exclusions.set(bookingId, req.user.id, body.excluded, body.note, body.declineId);
  }
}
