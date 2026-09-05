import type {
  OrderRiskActionContext,
  OrderRiskSeverity,
  OrderRiskType,
} from '../orders/order-risk.types';

type Locale = 'en' | 'fr';

/** Meta rejects template variables above 1024 chars and we also feed this to push. */
const MAX_SUMMARY_LENGTH = 300;

const RISK_LABELS: Record<OrderRiskType, Record<Locale, string>> = {
  pending_acceptance: {
    en: 'Not confirmed by merchant',
    fr: 'Non confirmée par le marchand',
  },
  prep_overdue: {
    en: 'Confirmed but not ready',
    fr: 'Confirmée mais pas prête',
  },
  ready_unassigned: {
    en: 'Ready with no agent',
    fr: 'Prête sans livreur',
  },
  pickup_uncollected: {
    en: 'Waiting to be collected',
    fr: 'En attente de retrait',
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

/**
 * One line an operator can act on without opening the admin panel: what is
 * wrong, which merchant, and the number to call. Also used verbatim as the
 * WhatsApp `reason` variable, so it stays single-line and bounded.
 */
export function buildOrderRiskActionSummary(
  reason: string,
  action?: OrderRiskActionContext,
  preferredLanguage?: string | null
): string {
  const locale = normalizeLanguage(preferredLanguage);
  const merchant = [action?.businessName, action?.locationName]
    .filter(Boolean)
    .join(locale === 'fr' ? ' — ' : ' at ');
  const parts = [
    reason,
    merchant,
    action?.merchantPhone
      ? `${locale === 'fr' ? 'Appeler' : 'Call'} ${action.merchantPhone}`
      : null,
    action?.clientName
      ? `${locale === 'fr' ? 'Client' : 'Client'} ${action.clientName}`
      : null,
    action?.amountLabel,
    action?.minutesUntilAutoDecline
      ? locale === 'fr'
        ? `Annulation auto dans ${action.minutesUntilAutoDecline} min`
        : `Auto-cancel in ${action.minutesUntilAutoDecline} min`
      : null,
  ].filter((part): part is string => !!part && part.trim().length > 0);
  return truncate(parts.join('. '), MAX_SUMMARY_LENGTH);
}

export function buildOrderRiskSuperuserPushMessage(params: {
  orderNumber: string;
  riskType: OrderRiskType;
  severity: OrderRiskSeverity;
  reason: string;
  action?: OrderRiskActionContext;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const label = RISK_LABELS[params.riskType][locale];
  const prefix = severityPrefix(params.severity, locale);
  const summary = buildOrderRiskActionSummary(
    params.reason,
    params.action,
    params.preferredLanguage
  );
  if (locale === 'fr') {
    return {
      title: `${prefix} Commande ${params.orderNumber} à risque`,
      body: `${label}. ${summary}`,
    };
  }
  return {
    title: `${prefix} Order ${params.orderNumber} at risk`,
    body: `${label}. ${summary}`,
  };
}

export function buildOrderRiskSuperuserEmail(params: {
  orderNumber: string;
  riskType: OrderRiskType;
  severity: OrderRiskSeverity;
  reason: string;
  action?: OrderRiskActionContext;
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
      ${buildActionRows(params.action)}
      <p>Open it in the admin panel (<code>${escapeHtml(params.adminUrl)}</code>) to contact the client, business, or agent.</p>
    `,
  };
}

function buildActionRows(action?: OrderRiskActionContext): string {
  const rows: Array<[string, string | null | undefined]> = [
    ['Merchant', action?.businessName],
    ['Location', action?.locationName],
    ['Merchant phone', action?.merchantPhone],
    ['Client', action?.clientName],
    ['Order total', action?.amountLabel],
    [
      'Auto-cancel in',
      action?.minutesUntilAutoDecline
        ? `${action.minutesUntilAutoDecline} min`
        : null,
    ],
  ];
  return rows
    .filter((row): row is [string, string] => !!row[1])
    .map(
      ([label, value]) =>
        `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
    )
    .join('');
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
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
