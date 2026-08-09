import { Injectable } from '@nestjs/common';
import type { WhatsAppTemplateComponent } from '../../whatsapp/whatsapp.types';
import type { WhatsAppChannelPayload } from './notification.types';

/** Maps internal template keys → Meta-approved template names (en_US / fr). */
const TEMPLATE_NAMES: Record<string, { en: string; fr: string }> = {
  order_created_business: { en: 'rs_order_new', fr: 'rs_order_new' },
  order_offer_agent: { en: 'rs_delivery_offer', fr: 'rs_delivery_offer' },
  order_status_client: { en: 'rs_order_status', fr: 'rs_order_status' },
  order_ready: { en: 'rs_order_ready', fr: 'rs_order_ready' },
  rental_request_business: { en: 'rs_rental_request', fr: 'rs_rental_request' },
  verification_attention: { en: 'rs_verification', fr: 'rs_verification' },
  delivery_pin: { en: 'rs_delivery_pin', fr: 'rs_delivery_pin' },
  pickup_reminder: { en: 'rs_pickup_reminder', fr: 'rs_pickup_reminder' },
  payment_failed: { en: 'rs_payment_failed', fr: 'rs_payment_failed' },
  ai_proposal_ready: { en: 'rs_ai_proposal', fr: 'rs_ai_proposal' },
};

/** Ordered body variables per template (Meta positional params). */
const BODY_VARS: Record<string, string[]> = {
  order_created_business: ['orderNumber', 'customerName', 'pickupWindow'],
  order_offer_agent: ['pickupArea', 'distance'],
  order_status_client: ['orderNumber', 'statusLabel'],
  order_ready: ['orderNumber'],
  rental_request_business: ['itemName', 'dates'],
  verification_attention: ['reason'],
  delivery_pin: ['pin', 'orderNumber'],
  pickup_reminder: ['orderNumber', 'window'],
  payment_failed: ['orderNumber'],
  ai_proposal_ready: ['itemName'],
};

@Injectable()
export class WhatsAppTemplateService {
  resolveMetaName(templateKey: string, locale?: string): string | null {
    const entry = TEMPLATE_NAMES[templateKey];
    if (!entry) return null;
    return locale === 'fr' ? entry.fr : entry.en;
  }

  languageCode(locale?: string): string {
    return locale === 'fr' ? 'fr' : 'en_US';
  }

  buildComponents(
    payload: WhatsAppChannelPayload
  ): WhatsAppTemplateComponent[] {
    const keys = BODY_VARS[payload.templateKey] ?? Object.keys(payload.variables);
    const bodyParams = keys
      .map((k) => payload.variables[k])
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .map((text) => ({ type: 'text' as const, text }));

    const components: WhatsAppTemplateComponent[] = [];
    if (bodyParams.length) {
      components.push({ type: 'body', parameters: bodyParams });
    }
    if (payload.ctaUrl && this.hasDynamicCtaParam(payload.ctaUrl)) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: this.ctaButtonParam(payload.ctaUrl) }],
      });
    }
    return components;
  }

  listTemplateCatalog(): Array<{
    templateKey: string;
    metaNameEn: string;
    metaNameFr: string;
    bodyVariables: string[];
  }> {
    return Object.keys(TEMPLATE_NAMES).map((templateKey) => ({
      templateKey,
      metaNameEn: TEMPLATE_NAMES[templateKey].en,
      metaNameFr: TEMPLATE_NAMES[templateKey].fr,
      bodyVariables: BODY_VARS[templateKey] ?? [],
    }));
  }

  /**
   * Meta URL button dynamic suffix. Templates are configured as
   * `https://rendasua.com/app/orders/{{1}}`, so pass the entity id only.
   * Static CTAs (e.g. /app/verification) must not send a button parameter.
   */
  private hasDynamicCtaParam(ctaUrl: string): boolean {
    const last = this.ctaButtonParam(ctaUrl);
    return (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        last
      ) || /^\d+$/.test(last)
    );
  }

  private ctaButtonParam(ctaUrl: string): string {
    try {
      const url = new URL(ctaUrl);
      const segments = url.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] || ctaUrl;
    } catch {
      const segments = ctaUrl.split('/').filter(Boolean);
      return segments[segments.length - 1] || ctaUrl;
    }
  }
}
