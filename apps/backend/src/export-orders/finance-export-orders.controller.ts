import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import {
  RecordExportPaymentDto,
  RecordSupplierPaymentDto,
  UpsertExportBankAccountDto,
} from './dto/admin-export-order.dto';
import { ExportOrdersFinanceService } from './export-orders-finance.service';

@ApiTags('finance-export-orders')
@Controller('admin/export-finance')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@RequirePermissions(PlatformPermissions.EXPORT_FINANCE)
export class FinanceExportOrdersController {
  constructor(private readonly finance: ExportOrdersFinanceService) {}

  @Post('bank-accounts')
  @ApiOperation({ summary: 'Set active export bank account' })
  async bankAccount(@Body() dto: UpsertExportBankAccountDto) {
    const data = await this.finance.upsertBankAccount(dto);
    return { success: true, data };
  }

  @Post('orders/:id/payments')
  @ApiOperation({ summary: 'Record client payment + receipt' })
  async payment(
    @Param('id') id: string,
    @Body() dto: RecordExportPaymentDto
  ) {
    const data = await this.finance.recordClientPayment(id, dto);
    return { success: true, data };
  }

  @Post('orders/:id/supplier-payments')
  @ApiOperation({ summary: 'Record supplier deposit/balance payment' })
  async supplierPayment(
    @Param('id') id: string,
    @Body() dto: RecordSupplierPaymentDto
  ) {
    const data = await this.finance.recordSupplierPayment(id, dto);
    return { success: true, data };
  }
}
