import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { OrderTaxLifecycleService } from './order-tax-lifecycle.service';
import { StripeTaxCodesService } from './stripe-tax-codes.service';
import { StripeTaxSyncResponseDto } from './dto/stripe-tax-code.dto';

@ApiTags('admin-stripe-tax')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.CONTENT_STRIPE_TAX)
@Controller('admin/stripe-tax')
export class StripeTaxAdminController {
  constructor(
    private readonly taxCodesService: StripeTaxCodesService,
    private readonly orderTaxLifecycle: OrderTaxLifecycleService
  ) {}

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

  @Post('reconcile')
  @ApiOperation({
    summary:
      'Finalize/heal order tax snapshots and reverse missed refund tax. Dry-run unless dryRun=false.',
  })
  async reconcile(
    @Body()
    body: { orderNumber?: string; limit?: number; dryRun?: boolean } = {}
  ) {
    const dryRun = body?.dryRun !== false;
    if (body?.orderNumber?.trim()) {
      const item = await this.orderTaxLifecycle.reconcileOrder(
        body.orderNumber.trim(),
        { dryRun }
      );
      return { success: true, dryRun, scanned: 1, items: [item] };
    }
    const limit = Math.min(Math.max(Number(body?.limit) || 25, 1), 100);
    const result = await this.orderTaxLifecycle.reconcileBatch({
      dryRun,
      limit,
    });
    return { success: true, dryRun, ...result };
  }
}
