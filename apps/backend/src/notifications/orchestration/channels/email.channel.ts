import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../../notifications.service';
import type { ChannelAttemptResult, EmailChannelPayload } from '../notification.types';

/**
 * Thin adapter: prefers HTML body via public merchant HTML helper when provided;
 * otherwise logs skip for template-key paths still owned by NotificationsService.
 */
@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);

  constructor(
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService
  ) {}

  async send(payload: EmailChannelPayload): Promise<ChannelAttemptResult> {
    if (!payload.to?.trim()) {
      return {
        channel: 'email',
        status: 'skipped',
        skippedReason: 'no_email',
      };
    }
    if (payload.html) {
      try {
        await this.notificationsService.sendMerchantEngagementHtmlEmail({
          to: payload.to,
          subject: payload.subject || 'Rendasua',
          html: payload.html,
        });
        return { channel: 'email', status: 'sent' };
      } catch (error: any) {
        this.logger.warn(`Email send failed: ${error?.message ?? String(error)}`);
        return {
          channel: 'email',
          status: 'failed',
          error: error?.message ?? String(error),
        };
      }
    }
    return {
      channel: 'email',
      status: 'skipped',
      skippedReason: 'use_notifications_service_template',
    };
  }
}
