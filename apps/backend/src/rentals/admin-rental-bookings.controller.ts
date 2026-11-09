import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions, RequireRoles } from '../rbac/permissions.decorator';
import { PlatformPermissions, PlatformRoles } from '../rbac/platform-permissions';
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
export class AdminRentalBookingsController {
  constructor(private readonly rentalsService: RentalsService) {}

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
}
