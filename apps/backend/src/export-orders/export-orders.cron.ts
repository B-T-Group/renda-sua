import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExportOrdersCommissionService } from './export-orders-commission.service';
import { ExportOrdersFulfillmentService } from './export-orders-fulfillment.service';

@Injectable()
export class ExportOrdersCron {
  private readonly logger = new Logger(ExportOrdersCron.name);

  constructor(
    private readonly fulfillment: ExportOrdersFulfillmentService,
    private readonly commissions: ExportOrdersCommissionService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiries() {
    try {
      await this.fulfillment.processExpiries();
    } catch (error: any) {
      this.logger.warn(`export expiries: ${error?.message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleFinancingReminders() {
    try {
      await this.commissions.sendFinancingReminders();
    } catch (error: any) {
      this.logger.warn(`export financing reminders: ${error?.message}`);
    }
  }
}
