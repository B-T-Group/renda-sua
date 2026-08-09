import { Injectable, Logger } from '@nestjs/common';
import { NotificationAnalyticsService } from './notification-analytics.service';
import { NotificationPreferenceService } from './notification-preference.service';

export type WhatsAppCommand =
  | 'CONFIRM'
  | 'DECLINE'
  | 'READY'
  | 'ACCEPT'
  | 'ARRIVED'
  | 'PICKED_UP'
  | 'COMPLETE'
  | 'YES'
  | 'NO'
  | 'STOP'
  | 'START'
  | 'UNKNOWN';

/**
 * Phase 4 reply router. Preference commands (STOP) are handled immediately.
 * Domain mutations are stubbed to call existing services once wired per command.
 */
@Injectable()
export class WhatsAppReplyService {
  private readonly logger = new Logger(WhatsAppReplyService.name);

  constructor(
    private readonly prefs: NotificationPreferenceService,
    private readonly analytics: NotificationAnalyticsService
  ) {}

  parseCommand(text: string): WhatsAppCommand {
    const normalized = text.trim().toUpperCase().replace(/\s+/g, '_');
    const aliases: Record<string, WhatsAppCommand> = {
      CONFIRM: 'CONFIRM',
      DECLINE: 'DECLINE',
      READY: 'READY',
      ACCEPT: 'ACCEPT',
      ARRIVED: 'ARRIVED',
      PICKED_UP: 'PICKED_UP',
      PICKEDUP: 'PICKED_UP',
      COMPLETE: 'COMPLETE',
      YES: 'YES',
      NO: 'NO',
      STOP: 'STOP',
      START: 'START',
      UNSUBSCRIBE: 'STOP',
    };
    return aliases[normalized] ?? 'UNKNOWN';
  }

  async handleInboundText(params: {
    fromPhone: string;
    text: string;
    messageId?: string;
  }): Promise<{ handled: boolean; command: WhatsAppCommand; userId?: string }> {
    const command = this.parseCommand(params.text);
    const userId = await this.prefs.findUserIdByPhoneE164(params.fromPhone);
    if (!userId) {
      this.logger.warn(`WhatsApp reply from unknown phone ${params.fromPhone}`);
      return { handled: false, command };
    }

    if (command === 'STOP') {
      await this.prefs.disableWhatsApp(userId);
      await this.analytics.track({
        notificationType: 'whatsapp.opt_out',
        category: 'actionable',
        userId,
        channel: 'whatsapp',
        status: 'replied',
        providerMessageId: params.messageId,
        meta: { command: 'STOP' },
      });
      return { handled: true, command, userId };
    }

    if (command === 'START') {
      // Explicit opt-in must happen in-app (decision 1A); acknowledge only.
      await this.analytics.track({
        notificationType: 'whatsapp.start_request',
        category: 'actionable',
        userId,
        channel: 'whatsapp',
        status: 'replied',
        providerMessageId: params.messageId,
        meta: { command: 'START' },
      });
      return { handled: true, command, userId };
    }

    // Domain mutations (CONFIRM/ACCEPT/…) — Phase 4: wire to OrdersService etc.
    await this.analytics.track({
      notificationType: 'whatsapp.command',
      category: 'actionable',
      userId,
      channel: 'whatsapp',
      status: 'replied',
      providerMessageId: params.messageId,
      meta: { command, deferred: true },
    });
    this.logger.log(
      `WhatsApp command ${command} from user ${userId} recorded (domain action deferred/flagged)`
    );
    return { handled: true, command, userId };
  }
}
