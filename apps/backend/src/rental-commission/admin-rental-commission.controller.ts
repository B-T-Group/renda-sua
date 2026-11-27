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
import { CreateCommissionRuleDto } from './rental-commission.dto';
import { RentalCommissionRulesService } from './rental-commission-rules.service';
import { RentalCommissionService } from './rental-commission.service';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('admin')
@Controller('admin/rentals/commission')
@UseGuards(AdminAuthGuard)
@RequireRoles(PlatformRoles.SUPERUSER, PlatformRoles.FINANCE)
@RequirePermissions(PlatformPermissions.FINANCIAL_COMMISSIONS)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminRentalCommissionController {
  constructor(
    private readonly rules: RentalCommissionRulesService,
    private readonly commission: RentalCommissionService
  ) {}

  @Get('rules')
  @ApiOperation({ summary: 'List rental commission rules' })
  @ApiQuery({ name: 'scope', required: false })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'ended'] })
  @ApiResponse({ status: 200, description: '{ success: true, data: { rules } }' })
  async listRules(
    @Query('scope') scope?: string,
    @Query('businessId') businessId?: string,
    @Query('status') status?: string
  ) {
    return { success: true, data: { rules: await this.rules.listRules({ scope, businessId, status }) } };
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a rule. Ends the open rule for the same key. Applies to bookings accepted from now on.' })
  @ApiBody({ type: CreateCommissionRuleDto })
  @ApiResponse({ status: 201, description: 'Rule created' })
  @ApiResponse({ status: 400, description: 'Invalid scope keys or window' })
  async createRule(@Body() dto: CreateCommissionRuleDto, @Req() req: RequestWithUser) {
    const rule = await this.rules.createRule(
      {
        scope: dto.scope,
        rate_bps: dto.rateBps,
        business_id: dto.businessId ?? null,
        rental_category_id: dto.rentalCategoryId ?? null,
        country_code: dto.countryCode?.toUpperCase() ?? null,
        campaign_code: dto.campaignCode ?? null,
        effective_from: dto.effectiveFrom ?? null,
        effective_to: dto.effectiveTo ?? null,
        reason: dto.reason,
      },
      req.user.id
    );
    return { success: true, data: { rule } };
  }

  @Post('rules/:id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End an active rule now' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Rule ended' })
  @ApiResponse({ status: 404, description: 'No active rule with this id' })
  async endRule(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: { rule: await this.rules.endRule(id) } };
  }

  @Get('report')
  @ApiOperation({ summary: 'Commission totals and bookings, by currency' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'businessId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['quoted', 'earned', 'reversed', 'waived'] })
  @ApiResponse({ status: 200, description: '{ success: true, data: { totals, bookings } }' })
  async report(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('businessId') businessId?: string,
    @Query('status') status?: string
  ) {
    return { success: true, data: await this.commission.report({ from, to, businessId, status }) };
  }
}
