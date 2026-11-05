import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientConfirmDeliveryService } from './client-confirm-delivery.service';

@Injectable()
export class ClientConfirmDeliveryCronService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClientConfirmDeliveryCronService.name);
  private autoCompleteRunning = false;
  private stuckRunning = false;
  private reminderRunning = false;
  private backfillRunning = false;

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

  /** In-flight MoMo orders get a deadline at deploy time (never retroactive). */
  onApplicationBootstrap(): void {
    setTimeout(() => void this.handleBackfillDeadlines(), 15_000).unref?.();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleReminders(): Promise<void> {
    if (this.reminderRunning) return;
    this.reminderRunning = true;
    try {
      const result = await this.clientConfirm.sendDueReminders();
      if (result.reminded > 0) {
        this.logger.log(`Sent ${result.reminded} delivered-order reminders`);
      }
    } catch (error: any) {
      this.logger.error(`Delivered reminder sweep failed: ${error?.message ?? error}`);
    } finally {
      this.reminderRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleBackfillDeadlines(): Promise<void> {
    if (this.backfillRunning) return;
    this.backfillRunning = true;
    try {
      const result = await this.clientConfirm.backfillInFlightDeadlines();
      if (result.backfilled > 0) {
        this.logger.log(`Gave ${result.backfilled} in-flight MoMo orders an auto-complete deadline`);
      }
    } catch (error: any) {
      this.logger.error(`In-flight deadline backfill failed: ${error?.message ?? error}`);
    } finally {
      this.backfillRunning = false;
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
