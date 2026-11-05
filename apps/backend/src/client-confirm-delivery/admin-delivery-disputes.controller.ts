import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import {
  AdminDeliveryDisputesService,
  DISPUTE_RESOLUTIONS,
  type DisputeResolution,
} from './admin-delivery-disputes.service';
import {
  DELIVERY_REPORT_OUTCOMES,
  type DeliveryReportOutcome,
} from './client-confirm-delivery.constants';

export class ResolveDeliveryDisputeDto {
  @IsIn(DISPUTE_RESOLUTIONS as unknown as string[])
  resolution!: DisputeResolution;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsIn(DELIVERY_REPORT_OUTCOMES.filter((o) => o !== 'pending') as string[])
  outcome?: DeliveryReportOutcome;

  @IsOptional()
  @IsBoolean()
  restoreInventory?: boolean;
}

@ApiTags('admin')
@Controller('admin/delivery-disputes')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.ORDERS_CROSS_BUSINESS)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminDeliveryDisputesController {
  constructor(private readonly disputes: AdminDeliveryDisputesService) {}

  @Get()
  @ApiOperation({ summary: 'Client delivery reports awaiting admin resolution' })
  async list(@Query('scope') scope?: string) {
    const rows = await this.disputes.list(scope === 'all' ? 'all' : 'open');
    return { success: true, disputes: rows };
  }

  @Post(':orderId/resolve')
  @RequirePermissions(PlatformPermissions.FINANCIAL_REFUNDS)
  @ApiOperation({ summary: 'Resolve a disputed delivery (moves money)' })
  async resolve(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: ResolveDeliveryDisputeDto
  ) {
    return this.disputes.resolve(orderId, body);
  }
}
