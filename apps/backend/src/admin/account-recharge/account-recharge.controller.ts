import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { PlatformPermissions } from '../../rbac/platform-permissions';
import { AccountRechargeService } from './account-recharge.service';
import { InitiateAccountRechargeDto } from './account-recharge.dto';

@ApiTags('admin-account-recharge')
@Controller('admin/account-recharge')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.RECHARGE_ACCOUNT)
@ApiBearerAuth()
export class AccountRechargeController {
  constructor(private readonly accountRechargeService: AccountRechargeService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate a mobile-money collection to top up the Rendasua HQ account' })
  @ApiResponse({ status: 200, description: 'Payment initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid country code, phone, or amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async initiateRecharge(@Body() dto: InitiateAccountRechargeDto) {
    const result = await this.accountRechargeService.initiateRecharge(dto);
    return { success: true, data: result };
  }

  @Get('transactions/:transactionId/status')
  @ApiOperation({ summary: 'Get the status of a recharge transaction' })
  @ApiParam({ name: 'transactionId', description: 'mobile_payment_transactions.id (UUID)' })
  @ApiResponse({ status: 200, description: 'Transaction status' })
  @ApiResponse({ status: 400, description: 'Transaction not found' })
  async getRechargeStatus(@Param('transactionId') transactionId: string) {
    if (!transactionId) {
      throw new BadRequestException('transactionId is required');
    }
    const tx = await this.accountRechargeService.getRechargeStatus(transactionId);
    return { success: true, data: tx };
  }

  @Get('recent')
  @ApiOperation({ summary: 'List recent HQ account top-up transactions' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Recent recharge transactions' })
  async listRecentRecharges(
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string
  ) {
    const limit = Math.min(100, Math.max(1, parseInt(limitStr || '20', 10) || 20));
    const offset = Math.max(0, parseInt(offsetStr || '0', 10) || 0);
    const items = await this.accountRechargeService.listRecentRecharges(limit, offset);
    return { success: true, data: { items, limit, offset } };
  }
}
