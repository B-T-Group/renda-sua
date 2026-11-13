import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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
    private readonly renterReturns: RentalRenterReturnService
  ) {}

  @Get('card-pickup-alerts')
  @ApiOperation({ summary: 'Open charge-at-pickup support alerts (renewal and overdue remainder)' })
  listCardPickupAlerts() {
    return this.rentalsService.listCardPickupAlerts();
  }

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
}
