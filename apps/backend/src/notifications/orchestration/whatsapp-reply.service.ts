import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { NotificationAnalyticsService } from './notification-analytics.service';
import { NotificationPreferenceService } from './notification-preference.service';
import {
  WhatsAppOrderActionService,
  type MerchantWaAction,
} from '../../orders/whatsapp-order-action.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';

export type WhatsAppCommand =
  | 'CONFIRM'
  | 'BUSY'
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

const BUTTON_TO_ACTION: Record<string, MerchantWaAction> = {
  confirm: 'CONFIRM',
  busy: 'BUSY',
  decline: 'DECLINE',
  need_more_time: 'BUSY',
};

/**
 * Preference commands (STOP) are handled immediately.
 * Merchant CONFIRM / BUSY / DECLINE mutate acceptance via WhatsAppOrderActionService.
 */
@Injectable()
export class WhatsAppReplyService {
  private readonly logger = new Logger(WhatsAppReplyService.name);

  constructor(
    private readonly prefs: NotificationPreferenceService,
    private readonly analytics: NotificationAnalyticsService,
    @Optional()
    @Inject(forwardRef(() => WhatsAppOrderActionService))
    private readonly orderActions: WhatsAppOrderActionService | null,
    @Optional() private readonly whatsapp: WhatsAppService | null
  ) {}

  parseCommand(text: string): WhatsAppCommand {
    const normalized = text.trim().toUpperCase().replace(/\s+/g, '_');
    const aliases: Record<string, WhatsAppCommand> = {
      CONFIRM: 'CONFIRM',
      CONFIRMER: 'CONFIRM',
      DECLINE: 'DECLINE',
      REFUSER: 'DECLINE',
      BUSY: 'BUSY',
      NEED_MORE_TIME: 'BUSY',
      BESOIN_DE_TEMPS: 'BUSY',
      OCCUPE: 'BUSY',
      OCCUPÉ: 'BUSY',
      READY: 'READY',
      ACCEPT: 'CONFIRM',
      ARRIVED: 'ARRIVED',
      PICKED_UP: 'PICKED_UP',
      PICKEDUP: 'PICKED_UP',
      COMPLETE: 'COMPLETE',
      YES: 'CONFIRM',
      OUI: 'CONFIRM',
      NO: 'DECLINE',
      NON: 'DECLINE',
      STOP: 'STOP',
      START: 'START',
      UNSUBSCRIBE: 'STOP',
    };
    return aliases[normalized] ?? 'UNKNOWN';
  }

  parseButtonReply(buttonId?: string, buttonTitle?: string): WhatsAppCommand {
    const id = (buttonId || '').trim().toLowerCase();
    if (id && BUTTON_TO_ACTION[id]) {
      return BUTTON_TO_ACTION[id] as WhatsAppCommand;
    }
    // Meta often echoes the localized button text as button_reply.id.
    if (buttonId?.trim()) {
      const fromId = this.parseCommand(buttonId);
      if (fromId !== 'UNKNOWN') return fromId;
    }
    if (buttonTitle?.trim()) return this.parseCommand(buttonTitle);
    return 'UNKNOWN';
  }

  async handleInboundText(params: {
    fromPhone: string;
    text: string;
    messageId?: string;
  }): Promise<{ handled: boolean; command: WhatsAppCommand; userId?: string }> {
    return this.dispatch({
      fromPhone: params.fromPhone,
      command: this.parseCommand(params.text),
      messageId: params.messageId,
    });
  }

  async handleInteractiveReply(params: {
    fromPhone: string;
    buttonId?: string;
    buttonTitle?: string;
    messageId?: string;
  }): Promise<{ handled: boolean; command: WhatsAppCommand; userId?: string }> {
    return this.dispatch({
      fromPhone: params.fromPhone,
      command: this.parseButtonReply(params.buttonId, params.buttonTitle),
      messageId: params.messageId,
    });
  }

  private async dispatch(params: {
    fromPhone: string;
    command: WhatsAppCommand;
    messageId?: string;
  }): Promise<{ handled: boolean; command: WhatsAppCommand; userId?: string }> {
    const { command } = params;
    const userId = await this.prefs.findUserIdByPhoneE164(params.fromPhone);

    if (command === 'STOP') {
      return this.handleStop(params.fromPhone, userId, params.messageId, command);
    }
    if (command === 'START') {
      return this.handleStart(userId, params.messageId, command);
    }

    const action = this.toMerchantAction(command);
    if (action) {
      return this.handleMerchantAction(
        params.fromPhone,
        action,
        command,
        userId,
        params.messageId
      );
    }

    if (userId) {
      await this.analytics.track({
        notificationType: 'whatsapp.command',
        category: 'actionable',
        userId,
        channel: 'whatsapp',
        status: 'replied',
        providerMessageId: params.messageId,
        meta: { command, deferred: true },
      });
    }
    this.logger.log(`WhatsApp command ${command} recorded (no merchant action)`);
    return { handled: !!userId, command, userId: userId ?? undefined };
  }

  private toMerchantAction(command: WhatsAppCommand): MerchantWaAction | null {
    if (command === 'CONFIRM' || command === 'YES') return 'CONFIRM';
    if (command === 'BUSY') return 'BUSY';
    if (command === 'DECLINE' || command === 'NO') return 'DECLINE';
    return null;
  }

  private async handleMerchantAction(
    fromPhone: string,
    action: MerchantWaAction,
    command: WhatsAppCommand,
    userId: string | null,
    messageId?: string
  ): Promise<{ handled: boolean; command: WhatsAppCommand; userId?: string }> {
    if (!this.orderActions) {
      this.logger.warn('WhatsAppOrderActionService unavailable');
      return { handled: false, command, userId: userId ?? undefined };
    }
    const result = await this.orderActions.handleAction({
      fromPhone,
      action,
    });
    await this.ackSession(fromPhone, result.message);
    if (userId) {
      await this.analytics.track({
        notificationType: 'whatsapp.command',
        category: 'actionable',
        userId,
        channel: 'whatsapp',
        status: 'replied',
        providerMessageId: messageId,
        meta: { command, action, handled: result.handled },
      });
    }
    return { handled: result.handled, command, userId: userId ?? undefined };
  }

  private async ackSession(to: string, body: string): Promise<void> {
    if (!this.whatsapp?.isConfigured()) return;
    try {
      await this.whatsapp.sendSessionText({ to, body });
    } catch (error: any) {
      this.logger.warn(`WA ack failed: ${error?.message ?? error}`);
    }
  }

  private async handleStop(
    fromPhone: string,
    userId: string | null,
    messageId: string | undefined,
    command: WhatsAppCommand
  ) {
    if (!userId) {
      this.logger.warn(`WhatsApp STOP from unknown phone ${fromPhone}`);
      return { handled: false, command };
    }
    await this.prefs.disableWhatsApp(userId);
    await this.analytics.track({
      notificationType: 'whatsapp.opt_out',
      category: 'actionable',
      userId,
      channel: 'whatsapp',
      status: 'replied',
      providerMessageId: messageId,
      meta: { command: 'STOP' },
    });
    return { handled: true, command, userId };
  }

  private async handleStart(
    userId: string | null,
    messageId: string | undefined,
    command: WhatsAppCommand
  ) {
    if (!userId) return { handled: false, command };
    await this.analytics.track({
      notificationType: 'whatsapp.start_request',
      category: 'actionable',
      userId,
      channel: 'whatsapp',
      status: 'replied',
      providerMessageId: messageId,
      meta: { command: 'START' },
    });
    return { handled: true, command, userId };
  }
}
