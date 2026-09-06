import { Injectable } from '@nestjs/common';
import type {
  WhatsAppTemplateCategory,
  WhatsAppTemplateComponent,
} from '../../whatsapp/whatsapp.types';
import type { WhatsAppChannelPayload } from './notification.types';

/** Maps internal template keys → Meta-approved template names (en / fr). */
const TEMPLATE_NAMES: Record<string, { en: string; fr: string }> = {
  order_created_business: { en: 'rs_order_created', fr: 'rs_order_created' },
  order_action_business: { en: 'rs_order_action', fr: 'rs_order_action' },
  order_offer_agent: { en: 'rs_delivery_offer', fr: 'rs_delivery_offer' },
  order_status_client: { en: 'rs_order_status', fr: 'rs_order_status' },
  order_ready: { en: 'rs_order_ready', fr: 'rs_order_ready' },
  rental_request_business: { en: 'rs_rental_request', fr: 'rs_rental_request' },
  verification_attention: { en: 'rs_verification', fr: 'rs_verification' },
  delivery_pin: { en: 'rs_delivery_pin', fr: 'rs_delivery_pin' },
  pickup_reminder: { en: 'rs_pickup_reminder', fr: 'rs_pickup_reminder' },
  payment_failed: { en: 'rs_payment_failed', fr: 'rs_payment_failed' },
  ai_proposal_ready: { en: 'rs_ai_proposal', fr: 'rs_ai_proposal' },
  admin_order_risk: { en: 'rs_admin_order_risk', fr: 'rs_admin_order_risk' },
  recipient_order_placed: {
    en: 'rs_recipient_order_placed',
    fr: 'rs_recipient_order_placed',
  },
  recipient_out_for_delivery: {
    en: 'rs_recipient_out_for_delivery',
    fr: 'rs_recipient_out_for_delivery',
  },
  recipient_order_ready: {
    en: 'rs_recipient_order_ready',
    fr: 'rs_recipient_order_ready',
  },
  recipient_order_update: {
    en: 'rs_recipient_order_update',
    fr: 'rs_recipient_order_update',
  },
};

/** Ordered body variables per template (Meta positional params). */
const BODY_VARS: Record<string, string[]> = {
  order_created_business: ['orderNumber', 'customerName', 'pickupWindow'],
  order_action_business: ['orderNumber', 'customerName', 'pickupWindow'],
  order_offer_agent: ['pickupArea', 'distance'],
  order_status_client: ['orderNumber', 'statusLabel'],
  order_ready: ['orderNumber'],
  rental_request_business: ['itemName', 'dates'],
  verification_attention: ['reason'],
  delivery_pin: ['pin'],
  pickup_reminder: ['orderNumber', 'window'],
  payment_failed: ['orderNumber'],
  ai_proposal_ready: ['itemName'],
  admin_order_risk: ['orderNumber', 'riskLabel', 'reason'],
  recipient_order_placed: ['payerName', 'storeName', 'orderNumber'],
  recipient_out_for_delivery: ['orderNumber'],
  recipient_order_ready: ['orderNumber', 'storeName'],
  recipient_order_update: ['orderNumber', 'statusLabel'],
};

/**
 * Templates Meta approved under the AUTHENTICATION category, mapped to the
 * variable holding the code. These do not follow the utility contract: the body
 * takes the code and nothing else, and the copy-code button repeats it. Sending
 * a second body parameter is rejected on parameter count.
 */
const AUTH_CODE_VARS: Record<string, string> = {
  delivery_pin: 'pin',
};

/**
 * Meta's approved category, which drives both transport and pricing. Only
 * non-utility templates are listed; everything else defaults to UTILITY.
 * Meta can recategorize a template after approval, so this must be kept in step
 * with WhatsApp Manager — see `docs/whatsapp-meta-templates.md`.
 */
const TEMPLATE_CATEGORIES: Record<string, WhatsAppTemplateCategory> = {
  delivery_pin: 'AUTHENTICATION',
  order_offer_agent: 'MARKETING',
};

/** Static URL buttons (no send-time {{1}}). Auth / no-CTA templates skip URL params. */
const STATIC_CTA_KEYS = new Set([
  'verification_attention',
  'order_action_business',
]);

/** Recipient templates have no URL CTA in Meta (appealed / approved bodies). */
const NO_CTA_KEYS = new Set([
  'recipient_order_placed',
  'recipient_out_for_delivery',
  'recipient_order_ready',
  'recipient_order_update',
]);

export type WhatsAppTemplateCatalogEntry = {
  templateKey: string;
  metaNameEn: string;
  metaNameFr: string;
  bodyVariables: string[];
  category: WhatsAppTemplateCategory;
  needsDynamicCta: boolean;
};

@Injectable()
export class WhatsAppTemplateService {
  resolveMetaName(templateKey: string, locale?: string): string | null {
    const entry = TEMPLATE_NAMES[templateKey];
    if (!entry) return null;
    return locale === 'fr' ? entry.fr : entry.en;
  }

  /** Internal key from a catalog key or Meta template name. */
  resolveTemplateKey(templateId: string): string | null {
    const needle = templateId.trim();
    if (!needle) return null;
    if (TEMPLATE_NAMES[needle]) return needle;
    return this.findKeyByMetaName(needle.toLowerCase());
  }

  requiredBodyVariables(templateKey: string): string[] {
    return BODY_VARS[templateKey] ?? [];
  }

  needsDynamicCta(templateKey: string): boolean {
    if (!TEMPLATE_NAMES[templateKey] || AUTH_CODE_VARS[templateKey]) {
      return false;
    }
    if (NO_CTA_KEYS.has(templateKey) || STATIC_CTA_KEYS.has(templateKey)) {
      return false;
    }
    return true;
  }

  /**
   * Meta rejects a send with #132001 when the template has no translation in the
   * requested language. Our templates are approved as `en` and `fr` — not
   * `en_US` — so those are the only two codes we may ask for.
   */
  languageCode(locale?: string): string {
    return locale === 'fr' ? 'fr' : 'en';
  }

  /** Meta's approved category for this template; drives transport and pricing. */
  category(templateKey: string): WhatsAppTemplateCategory {
    return TEMPLATE_CATEGORIES[templateKey] ?? 'UTILITY';
  }

  buildComponents(
    payload: WhatsAppChannelPayload
  ): WhatsAppTemplateComponent[] {
    const codeVar = AUTH_CODE_VARS[payload.templateKey];
    if (codeVar) return this.buildAuthComponents(payload, codeVar);

    const keys = BODY_VARS[payload.templateKey] ?? Object.keys(payload.variables);
    const bodyParams = keys.map((k) => this.bodyTextParam(payload.variables[k]));

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

  /**
   * Authentication templates carry the code twice: once in the body and once on
   * the OTP button. Meta keeps the send-time button `sub_type` as `url` even
   * though the button is created as type OTP, and the template's own CTA is
   * ignored — there is no URL to parameterize.
   */
  private buildAuthComponents(
    payload: WhatsAppChannelPayload,
    codeVariable: string
  ): WhatsAppTemplateComponent[] {
    const code = payload.variables[codeVariable]?.trim();
    if (!code) return [];
    return [
      { type: 'body', parameters: [{ type: 'text', text: code }] },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: code }],
      },
    ];
  }

  listTemplateCatalog(): WhatsAppTemplateCatalogEntry[] {
    return Object.keys(TEMPLATE_NAMES).map((templateKey) => ({
      templateKey,
      metaNameEn: TEMPLATE_NAMES[templateKey].en,
      metaNameFr: TEMPLATE_NAMES[templateKey].fr,
      bodyVariables: BODY_VARS[templateKey] ?? [],
      category: this.category(templateKey),
      needsDynamicCta: this.needsDynamicCta(templateKey),
    }));
  }

  private findKeyByMetaName(metaName: string): string | null {
    const match = Object.entries(TEMPLATE_NAMES).find(
      ([key, names]) =>
        key.toLowerCase() === metaName ||
        names.en === metaName ||
        names.fr === metaName
    );
    return match?.[0] ?? null;
  }

  private bodyTextParam(value: unknown): { type: 'text'; text: string } {
    const text =
      typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    return { type: 'text', text: text || '-' };
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
