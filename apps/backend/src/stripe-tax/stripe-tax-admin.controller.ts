import { Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { StripeTaxCodesService } from './stripe-tax-codes.service';
import { StripeTaxSyncResponseDto } from './dto/stripe-tax-code.dto';

@ApiTags('admin-stripe-tax')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.CONTENT_STRIPE_TAX)
@Controller('admin/stripe-tax')
export class StripeTaxAdminController {
  constructor(private readonly taxCodesService: StripeTaxCodesService) {}

  @Post('codes/sync')
  @ApiOperation({ summary: 'Sync Stripe tax codes from Stripe API' })
  @ApiResponse({ status: 200, type: StripeTaxSyncResponseDto })
  async syncCodes(): Promise<StripeTaxSyncResponseDto> {
    const result = await this.taxCodesService.syncFromStripe();
    return {
      success: true,
      upserted: result.upserted,
      deactivated: result.deactivated,
      message: `Synced ${result.upserted} tax codes; deactivated ${result.deactivated}`,
    };
  }
}
