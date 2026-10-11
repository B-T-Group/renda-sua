import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeepLinkService } from '../notifications/deep-link.service';
import { NotificationAnalyticsService } from '../notifications/orchestration/notification-analytics.service';
import { isRestockSchemaUnavailable } from './restock-alerts.errors';
import { RestockAlertsProcessor, type LinkBuilder } from './restock-alerts.processor';
import { HasuraRestockRepository } from './restock-alerts.repository';
import { NotificationRestockAnalytics, OrchestratorRestockNotifier } from './restock-alerts.notifier';

export function buildLinks(deepLinks: DeepLinkService): LinkBuilder {
  return {
    item(itemId: string) {
      const l = deepLinks.custom(`items/${itemId}?src=restock_alert`, `/items/${itemId}?src=restock_alert`);
      return { url: l.universal, appLink: l.app, path: l.path };
    },
    likesBackInStock() {
      const l = deepLinks.custom(
        'likes?filter=back_in_stock&src=restock_alert',
        '/likes?filter=back_in_stock&src=restock_alert'
      );
      return { url: l.universal, appLink: l.app, path: l.path };
    },
  };
}

/** Every minute. Multi-instance safe: DB compare-and-set lock + per-send idempotency keys. */
@Injectable()
export class RestockAlertsCron {
  private readonly logger = new Logger(RestockAlertsCron.name);
  private readonly processor: RestockAlertsProcessor;

  constructor(
    repo: HasuraRestockRepository,
    notifier: OrchestratorRestockNotifier,
    events: NotificationAnalyticsService,
    deepLinks: DeepLinkService
  ) {
    this.processor = new RestockAlertsProcessor(
      repo,
      notifier,
      new NotificationRestockAnalytics(events),
      buildLinks(deepLinks)
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handle(): Promise<void> {
    try {
      const summary = await this.processor.run(new Date());
      if (summary.ran && (summary.eventsFannedOut || summary.messagesSent)) {
        this.logger.log(
          `restock alerts: events=${summary.eventsFannedOut} queued=${summary.sendsQueued} sent=${summary.messagesSent}`
        );
      }
    } catch (e: any) {
      logRestockCronFailure(this.logger, e);
    }
  }
}

export function logRestockCronFailure(logger: Logger, error: any): void {
  const message = error?.message ?? error;
  if (isRestockSchemaUnavailable(error)) {
    logger.warn(`restock alerts skipped: ${message}`);
    return;
  }
  logger.error(`restock alerts run failed: ${message}`);
}
