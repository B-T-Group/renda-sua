import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientConfirmDeliveryService } from './client-confirm-delivery.service';

@Injectable()
export class ClientConfirmDeliveryCronService {
  private readonly logger = new Logger(ClientConfirmDeliveryCronService.name);
  private autoCompleteRunning = false;
  private stuckRunning = false;

  constructor(private readonly clientConfirm: ClientConfirmDeliveryService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoComplete(): Promise<void> {
    if (this.autoCompleteRunning) return;
    this.autoCompleteRunning = true;
    try {
      const result = await this.clientConfirm.autoCompleteDue();
      if (result.completed > 0) {
        this.logger.log(`Auto-completed ${result.completed} delivery confirmations`);
      }
    } catch (error: any) {
      this.logger.error(`Auto-complete sweep failed: ${error?.message ?? error}`);
    } finally {
      this.autoCompleteRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleNonStripeStuck(): Promise<void> {
    if (this.stuckRunning) return;
    this.stuckRunning = true;
    try {
      const result = await this.clientConfirm.processNonStripeStuck();
      if (result.reminded1h + result.reminded24h + result.tickets > 0) {
        this.logger.log(`Non-Stripe confirm reminders: ${JSON.stringify(result)}`);
      }
    } catch (error: any) {
      this.logger.error(`Non-Stripe stuck sweep failed: ${error?.message ?? error}`);
    } finally {
      this.stuckRunning = false;
    }
  }
}
