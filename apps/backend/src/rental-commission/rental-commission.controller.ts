import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommissionPreviewQueryDto } from './rental-commission.dto';
import { RentalCommissionService } from './rental-commission.service';

/** Business-facing commission reads. The renter pays no commission and sees none of this. */
@ApiTags('rentals')
@Controller('rentals')
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class RentalCommissionController {
  constructor(private readonly commission: RentalCommissionService) {}

  @Get('business/requests/:id/commission-preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview the commission and merchant payout for a rental request (business)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'totalOverride', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description:
      '{ success: true, data: { enabled, currency, base_amount, rate_bps, commission_amount, merchant_payout_amount, source, campaign_code, promo_ends_at } }',
  })
  @ApiResponse({ status: 403, description: 'Not the business that owns the listing' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 503, description: 'No default commission rate is configured' })
  async preview(@Param('id', ParseUUIDPipe) requestId: string, @Query() query: CommissionPreviewQueryDto) {
    const data = await this.commission.previewForBusiness(requestId, query.totalOverride);
    return { success: true, data };
  }

  @Get('business/commission')
  @ApiOperation({ summary: 'Commission summary and per-booking breakdown for the current business' })
  @ApiResponse({ status: 200, description: '{ success: true, data: { promo, totals, bookings } }' })
  @ApiResponse({ status: 403, description: 'Not a business user' })
  async summary() {
    return { success: true, data: await this.commission.businessSummary() };
  }
}
