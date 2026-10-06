import { Logger } from '@nestjs/common';
import { SiteEventsService } from './site-events.service';
import { SiteEventTypeV1 } from './site-event-types';

const logger = new Logger('ServerSiteEvents');

/**
 * Emit a server-written site event in fire-and-forget mode.
 * No subject is used for high-frequency events to avoid the 12h dedupe.
 * Failures are caught and logged; they never throw.
 */
export function emitServerSiteEvent(
  siteEventsService: SiteEventsService,
  eventType: SiteEventTypeV1,
  metadata: Record<string, unknown>
): void {
  // Fire-and-forget: do not await
  void siteEventsService
    .trackEvent(
      {
        eventType,
        metadata,
        // No subject - avoids 12h dedupe for repeated checks
        subjectType: undefined,
        subjectId: undefined,
      },
      {
        viewerType: 'server',
        viewerId: 'system',
        jwtVerified: false,
      }
    )
    .catch((error: any) => {
      // SiteEventsService already logs errors, but add extra safety
      logger.error(
        `Failed to emit ${eventType}: ${error?.message ?? error}`,
        error?.stack
      );
    });
}
