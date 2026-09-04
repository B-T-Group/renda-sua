import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantIdentityService } from '../../assistant/assistant-identity.service';
import { AssistantService } from '../../assistant/assistant.service';
import type {
  AssistantChatMessage,
  AssistantTurnResult,
} from '../../assistant/assistant.types';
import type { Configuration } from '../../config/configuration';
import { NotificationAnalyticsService } from './notification-analytics.service';
import { NotificationPreferenceService } from './notification-preference.service';
import {
  WhatsAppOrderActionService,
  type MerchantWaAction,
} from '../../orders/whatsapp-order-action.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { WhatsAppInboxPersistenceService } from './whatsapp-inbox-persistence.service';

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
 * Unmatched text may be answered by the AI assistant when enabled.
 */
@Injectable()
export class WhatsAppReplyService {
  private readonly logger = new Logger(WhatsAppReplyService.name);
  /** Per-phone lock so background Bedrock turns do not overlap for one sender. */
  private readonly assistantInFlight = new Set<string>();
  /** Latest inbound text waiting while a turn is in flight (overwrites older). */
  private readonly assistantPending = new Map<
    string,
    { text: string; messageId?: string; userId: string | null }
  >();
  /** Phones that opted out / cancelled while a turn was running. */
  private readonly assistantCancelled = new Set<string>();

  constructor(
    private readonly prefs: NotificationPreferenceService,
    private readonly analytics: NotificationAnalyticsService,
    @Optional()
    @Inject(forwardRef(() => WhatsAppOrderActionService))
    private readonly orderActions: WhatsAppOrderActionService | null,
    @Optional() private readonly whatsapp: WhatsAppService | null,
    @Optional() private readonly assistant: AssistantService | null,
    @Optional() private readonly identityService: AssistantIdentityService | null,
    private readonly inbox: WhatsAppInboxPersistenceService,
    private readonly configService: ConfigService<Configuration>
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
      text: params.text,
      command: this.parseCommand(params.text),
      messageId: params.messageId,
    });
  }

  async handleInteractiveReply(params: {
    fromPhone: string;
    buttonId?: string;
    buttonTitle?: string;
    messageId?: string;
    contextMessageId?: string;
  }): Promise<{ handled: boolean; command: WhatsAppCommand; userId?: string }> {
    return this.dispatch({
      fromPhone: params.fromPhone,
      command: this.parseButtonReply(params.buttonId, params.buttonTitle),
      messageId: params.messageId,
      contextMessageId: params.contextMessageId,
    });
  }

  private async dispatch(params: {
    fromPhone: string;
    text?: string;
    command: WhatsAppCommand;
    messageId?: string;
    contextMessageId?: string;
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
        params.messageId,
        params.contextMessageId
      );
    }

    if (command === 'UNKNOWN' && params.text) {
      if (this.assistant?.isWhatsAppRepliesEnabled()) {
        this.enqueueAssistantReply({
          fromPhone: params.fromPhone,
          text: params.text,
          messageId: params.messageId,
          userId,
        });
        return { handled: true, command, userId: userId ?? undefined };
      }
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

  private enqueueAssistantReply(params: {
    fromPhone: string;
    text: string;
    messageId?: string;
    userId: string | null;
  }): void {
    const phoneKey = params.fromPhone.replace(/^\+/, '');
    this.assistantCancelled.delete(phoneKey);
    if (this.assistantInFlight.has(phoneKey)) {
      this.assistantPending.set(phoneKey, {
        text: params.text,
        messageId: params.messageId,
        userId: params.userId,
      });
      return;
    }
    this.assistantInFlight.add(phoneKey);
    // Do not await Bedrock — Meta requires a fast webhook 200.
    void this.tryAssistantReply(params)
      .catch((error: any) => {
        this.logger.warn(
          `WhatsApp assistant background failed: ${error?.message ?? error}`
        );
      })
      .finally(() => {
        this.assistantInFlight.delete(phoneKey);
        if (this.assistantCancelled.has(phoneKey)) {
          this.assistantCancelled.delete(phoneKey);
          this.assistantPending.delete(phoneKey);
          return;
        }
        const pending = this.assistantPending.get(phoneKey);
        if (!pending) return;
        this.assistantPending.delete(phoneKey);
        this.enqueueAssistantReply({
          fromPhone: params.fromPhone,
          text: pending.text,
          messageId: pending.messageId,
          userId: pending.userId,
        });
      });
  }

  private cancelAssistantForPhone(fromPhone: string): void {
    const phoneKey = fromPhone.replace(/^\+/, '');
    this.assistantCancelled.add(phoneKey);
    this.assistantPending.delete(phoneKey);
  }

  private async tryAssistantReply(params: {
    fromPhone: string;
    text: string;
    messageId?: string;
    userId: string | null;
  }): Promise<boolean> {
    if (!this.assistant?.isWhatsAppRepliesEnabled()) return false;
    if (!this.identityService || !this.whatsapp?.isConfigured()) return false;
    const phoneKey = params.fromPhone.replace(/^\+/, '');
    if (this.assistantCancelled.has(phoneKey)) return false;
    const fallbackLocale = this.assistant.detectLocaleFromText(params.text);
    try {
      const result = await this.runAssistantTurn(params.fromPhone, params.text);
      if (this.assistantCancelled.has(phoneKey)) return false;
      await this.sendAssistantReply(params.fromPhone, result.reply);
      await this.trackAssistantReply(params, result);
      return true;
    } catch (error: any) {
      this.logger.warn(`WhatsApp assistant failed: ${error?.message ?? error}`);
      if (this.assistantCancelled.has(phoneKey)) return false;
      await this.sendAssistantReply(
        params.fromPhone,
        this.assistant.fallbackTechnical(fallbackLocale)
      );
      return true;
    }
  }

  private async runAssistantTurn(
    fromPhone: string,
    text: string
  ): Promise<AssistantTurnResult> {
    const identity = await this.identityService!.resolveFromPhone(fromPhone);
    const messages = await this.loadAssistantHistory(fromPhone, text);
    return this.assistant!.chat({
      channel: 'whatsapp',
      messages,
      identity,
      locale: identity.preferredLanguage,
    });
  }

  private async loadAssistantHistory(
    waId: string,
    inboundText: string
  ): Promise<AssistantChatMessage[]> {
    const limit =
      this.configService.get('assistant.maxHistoryMessages', { infer: true }) ??
      10;
    const recent = await this.inbox.listRecentMessages(
      waId.replace(/^\+/, ''),
      limit
    );
    const messages = recent.map((message) => ({
      role:
        message.direction === 'inbound'
          ? ('user' as const)
          : ('assistant' as const),
      content: message.body,
    }));
    const target = inboundText.trim();
    let endIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content.trim() === target) {
        endIdx = i;
        break;
      }
    }
    if (endIdx >= 0) {
      return messages.slice(0, endIdx + 1);
    }
    messages.push({ role: 'user', content: inboundText });
    return messages;
  }

  private async trackAssistantReply(
    params: { userId: string | null; messageId?: string },
    result: AssistantTurnResult
  ): Promise<void> {
    if (!params.userId) return;
    await this.analytics.track({
      notificationType: 'whatsapp.assistant',
      category: 'informational',
      userId: params.userId,
      channel: 'whatsapp',
      status: 'sent',
      providerMessageId: params.messageId,
      meta: { handoff: result.handoff },
    });
  }

  private async sendAssistantReply(to: string, body: string): Promise<void> {
    if (!this.whatsapp?.isConfigured() || !body.trim()) return;
    const reply = this.clipReply(body);
    try {
      const sendResult = await this.whatsapp.sendSessionText({ to, body: reply });
      await this.inbox.persistOutbound({
        waId: to.replace(/^\+/, ''),
        customerPhone: to.replace(/^\+/, ''),
        wamid: sendResult?.messages?.[0]?.id,
        source: 'system',
        type: 'text',
        body: reply,
        rawPayload: { source: 'assistant' },
        status: 'sent',
      });
    } catch (error: any) {
      this.logger.warn(`WA assistant send failed: ${error?.message ?? error}`);
    }
  }

  private clipReply(body: string): string {
    const max =
      this.configService.get('assistant.whatsappMaxReplyChars', {
        infer: true,
      }) ?? 1200;
    if (body.length <= max) return body;
    return `${body.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
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
    messageId?: string,
    contextMessageId?: string
  ): Promise<{ handled: boolean; command: WhatsAppCommand; userId?: string }> {
    if (!this.orderActions) {
      this.logger.warn('WhatsAppOrderActionService unavailable');
      return { handled: false, command, userId: userId ?? undefined };
    }
    const result = await this.orderActions.handleAction({
      fromPhone,
      action,
      contextMessageId,
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
    this.cancelAssistantForPhone(fromPhone);
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
