import { Injectable } from '@nestjs/common';
import { getQuickMessageTemplate } from '../quick-message.catalog';
import type {
  QuickMessagePayloadV1,
  QuickMessageStructuredContent,
  StructuredMessageCreateContext,
  StructuredMessageEnrichContext,
  StructuredMessageHandler,
} from '../structured-message.types';

@Injectable()
export class QuickMessageHandler implements StructuredMessageHandler {
  readonly type = 'QUICK_MESSAGE' as const;
  readonly pushNotificationType = 'order_quick_message';

  buildDisplayMessage(_ctx: StructuredMessageCreateContext): string {
    return JSON.stringify({
      i18nKey: 'orders.quickMessages.fallback',
      params: {},
      defaultMessage: 'Quick message',
    });
  }

  buildDisplayMessageForTemplate(templateId: string): string {
    const template = getQuickMessageTemplate(templateId);
    return JSON.stringify({
      i18nKey: template?.i18nKey ?? 'orders.quickMessages.fallback',
      params: {},
      defaultMessage: template?.defaultMessageEn ?? 'Quick message',
    });
  }

  enrichForViewer(
    payload: Record<string, unknown>,
    _ctx: StructuredMessageEnrichContext
  ): QuickMessageStructuredContent | null {
    const p = payload as unknown as QuickMessagePayloadV1;
    if (p.version !== 1 || !p.templateId) return null;
    const template = getQuickMessageTemplate(p.templateId);
    return {
      templateId: p.templateId,
      taggedUserIds: p.taggedUserIds ?? [],
      taggedPersonas: p.taggedPersonas ?? [],
      bodyI18nKey: template?.i18nKey ?? 'orders.quickMessages.fallback',
      bodyDefault: template?.defaultMessageEn ?? 'Quick message',
    };
  }

  resolveRecipients(
    _order: import('../../messaging.types').MessagingOrder,
    payload: Record<string, unknown>
  ): Array<{ userId: string; type: 'mentioned' | 'default_route' }> {
    const p = payload as unknown as QuickMessagePayloadV1;
    return (p.taggedUserIds ?? []).map((userId) => ({
      userId,
      type: 'mentioned' as const,
    }));
  }

  buildPayload(
    templateId: string,
    taggedUserIds: string[],
    taggedPersonas: string[]
  ): QuickMessagePayloadV1 {
    return {
      version: 1,
      templateId,
      taggedUserIds,
      taggedPersonas,
    };
  }
}
