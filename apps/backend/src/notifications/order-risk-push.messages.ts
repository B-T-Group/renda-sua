import type {
  OrderRiskSeverity,
  OrderRiskType,
} from '../orders/order-risk.types';

type Locale = 'en' | 'fr';

const RISK_LABELS: Record<OrderRiskType, Record<Locale, string>> = {
  pending_acceptance: {
    en: 'Not confirmed by merchant',
    fr: 'Non confirmée par le marchand',
  },
  ready_unassigned: {
    en: 'Ready with no agent',
    fr: 'Prête sans livreur',
  },
  pickup_overdue: {
    en: 'Agent has not picked up',
    fr: 'Livreur n’a pas récupéré',
  },
  delivery_delayed: {
    en: 'Delivery running late',
    fr: 'Livraison en retard',
  },
};

export function orderRiskLabel(
  riskType: OrderRiskType,
  preferredLanguage?: string | null
): string {
  return RISK_LABELS[riskType][normalizeLanguage(preferredLanguage)];
}

export function buildOrderRiskSuperuserPushMessage(params: {
  orderNumber: string;
  riskType: OrderRiskType;
  severity: OrderRiskSeverity;
  reason: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const label = RISK_LABELS[params.riskType][locale];
  const prefix = severityPrefix(params.severity, locale);
  if (locale === 'fr') {
    return {
      title: `${prefix} Commande ${params.orderNumber} à risque`,
      body: `${label}. ${params.reason}`,
    };
  }
  return {
    title: `${prefix} Order ${params.orderNumber} at risk`,
    body: `${label}. ${params.reason}`,
  };
}

export function buildOrderRiskSuperuserEmail(params: {
  orderNumber: string;
  riskType: OrderRiskType;
  severity: OrderRiskSeverity;
  reason: string;
  adminUrl: string;
}): { subject: string; html: string } {
  const label = RISK_LABELS[params.riskType].en;
  const severity = params.severity === 'critical' ? 'Critical' : 'Warning';
  return {
    subject: `[${severity}] Order ${params.orderNumber} needs intervention`,
    html: `
      <p>Order <strong>${escapeHtml(params.orderNumber)}</strong> needs a human.</p>
      <p><strong>Risk:</strong> ${escapeHtml(label)}</p>
      <p><strong>Detail:</strong> ${escapeHtml(params.reason)}</p>
      <p>Open it in the admin panel (<code>${escapeHtml(params.adminUrl)}</code>) to contact the client, business, or agent.</p>
    `,
  };
}

function severityPrefix(severity: OrderRiskSeverity, locale: Locale): string {
  if (severity !== 'critical') return locale === 'fr' ? '[Alerte]' : '[Warning]';
  return locale === 'fr' ? '[Critique]' : '[Critical]';
}

function normalizeLanguage(lang?: string | null): Locale {
  return lang?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
