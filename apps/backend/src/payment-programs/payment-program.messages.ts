import { normalizeLanguage, type EmailLocale } from '../notifications/email-template-data';

function formatAmount(amount: number, currency: string, locale: EmailLocale): string {
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function scheduleCreditCopy(params: {
  amount: number;
  currency: string;
  name: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const amount = formatAmount(params.amount, params.currency, locale);
  if (locale === 'fr') {
    return {
      title: 'Paiement programmé reçu',
      body: `+${amount} — ${params.name}`,
    };
  }
  return { title: 'Scheduled payment received', body: `+${amount} — ${params.name}` };
}

export function facilityCopy(params: {
  limit: number;
  currency: string;
  name: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const amount = formatAmount(params.limit, params.currency, locale);
  if (locale === 'fr') {
    return {
      title: 'Avance de fonds ouverte',
      body: `Vous pouvez retirer jusqu’à ${amount} (${params.name}).`,
    };
  }
  return {
    title: 'Cash advance opened',
    body: `You can draw up to ${amount} (${params.name}).`,
  };
}

export function drawCopy(params: {
  amount: number;
  currency: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const amount = formatAmount(params.amount, params.currency, locale);
  if (locale === 'fr') {
    return { title: 'Avance créditée', body: `${amount} ajoutés à votre solde.` };
  }
  return { title: 'Cash advance credited', body: `${amount} added to your balance.` };
}

export function creditGrantCopy(params: {
  amount: number;
  currency: string;
  scopeLabel: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const amount = formatAmount(params.amount, params.currency, locale);
  if (locale === 'fr') {
    return {
      title: 'Crédit d’achat reçu',
      body: `${amount} applicables ${params.scopeLabel}. Non retirables.`,
    };
  }
  return {
    title: 'Purchase credit received',
    body: `${amount} applies ${params.scopeLabel}. Not withdrawable.`,
  };
}

export function campaignCashCopy(params: {
  amount: number;
  currency: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const amount = formatAmount(params.amount, params.currency, locale);
  if (locale === 'fr') {
    return {
      title: 'Récompense de parrainage',
      body: `${amount} ont été ajoutés à votre portefeuille. Vous pouvez les retirer.`,
    };
  }
  return {
    title: 'Referral reward',
    body: `${amount} was added to your wallet. You can withdraw it.`,
  };
}

export function scopeLabel(
  applicability: string,
  businessName: string | null,
  locale: EmailLocale
): string {
  if (applicability === 'specific_business') {
    const name = businessName || (locale === 'fr' ? 'un partenaire' : 'a partner');
    return locale === 'fr' ? `chez ${name}` : `at ${name}`;
  }
  if (applicability === 'partner_businesses') {
    return locale === 'fr' ? 'chez les partenaires Rendasua' : 'at Rendasua partner stores';
  }
  return locale === 'fr' ? 'dans toute boutique' : 'at any store';
}
