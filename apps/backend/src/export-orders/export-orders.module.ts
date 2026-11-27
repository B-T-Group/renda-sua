import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';
import { AdminExportOrdersController } from './admin-export-orders.controller';
import { AgentExportOrdersController } from './agent-export-orders.controller';
import { BusinessExportOrdersController } from './business-export-orders.controller';
import { ExportDocNumberService } from './export-doc-number.service';
import { ExportOrdersAdminService } from './export-orders-admin.service';
import { ExportOrdersClientService } from './export-orders-client.service';
import { ExportOrdersCommissionService } from './export-orders-commission.service';
import { ExportOrdersCron } from './export-orders.cron';
import { ExportOrdersDashboardService } from './export-orders-dashboard.service';
import { ExportOrdersFinanceService } from './export-orders-finance.service';
import { ExportOrdersFulfillmentService } from './export-orders-fulfillment.service';
import { ExportOrdersPdfService } from './export-orders-pdf.service';
import { ExportOrdersTransitionService } from './export-orders-transition.service';
import { ExportOrdersController } from './export-orders.controller';
import { ExportOrdersService } from './export-orders.service';
import { FinanceExportOrdersController } from './finance-export-orders.controller';

@Module({
  imports: [HasuraModule, NotificationsModule, PdfModule, AdminAuthModule],
  controllers: [
    ExportOrdersController,
    AdminExportOrdersController,
    FinanceExportOrdersController,
    BusinessExportOrdersController,
    AgentExportOrdersController,
  ],
  providers: [
    ExportOrdersService,
    ExportOrdersTransitionService,
    ExportOrdersAdminService,
    ExportOrdersClientService,
    ExportOrdersFinanceService,
    ExportOrdersFulfillmentService,
    ExportOrdersPdfService,
    ExportOrdersCommissionService,
    ExportOrdersDashboardService,
    ExportDocNumberService,
    ExportOrdersCron,
  ],
  exports: [ExportOrdersService],
})
export class ExportOrdersModule {}
