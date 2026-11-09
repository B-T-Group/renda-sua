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
import { DecideInspectionDisputeDto } from './dto/rental-inspection.dto';
import { RentalInspectionService } from './inspection/rental-inspection.service';
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
    private readonly inspections: RentalInspectionService
  ) {}

  @Post('bookings/:id/start-overwrite-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a one-time rental start code (support)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async issueStartCode(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Req() req: RequestWithUser
  ) {
    return this.rentalsService.issueStartOverwriteCodeForSupport(
      bookingId,
      req.user.id
    );
  }

  @Get('inspection-disputes')
  @ApiOperation({ summary: 'Open and escalated rental inspection reviews' })
  listDisputes() {
    return this.inspections.listOpenDisputes();
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
