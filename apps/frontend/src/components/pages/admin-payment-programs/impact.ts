export function formatProgramMoney(amount: string, currency: string, locale: string): string | null {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || !currency) return null;
  const language = locale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  const digits = currency === 'XAF' || currency === 'XOF' ? 0 : 2;
  try {
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

type Translate = (key: string, fallback: string, options?: Record<string, string>) => string;

const EVERY: Record<string, [string, string]> = {
  daily: ['admin.paymentPrograms.every.daily', 'every day'],
  weekly: ['admin.paymentPrograms.every.weekly', 'every week'],
  biweekly: ['admin.paymentPrograms.every.biweekly', 'every two weeks'],
  monthly: ['admin.paymentPrograms.every.monthly', 'every month'],
};

export function scheduleImpact(
  t: Translate,
  input: { amount: string; currency: string; frequency: string; days?: string; name?: string; locale: string }
): string {
  const money = formatProgramMoney(input.amount, input.currency, input.locale);
  if (!money) return t('admin.paymentPrograms.needAmount', 'Enter an amount to see what an agent would receive.');
  const copy = scheduleCopy(input);
  return t(copy.key, copy.fallback, scheduleVars(t, input, money));
}

function scheduleCopy(input: { days?: string; name?: string }): { key: string; fallback: string } {
  const days = Number(input.days) > 0;
  const name = Boolean(input.name?.trim());
  if (days && name) {
    return {
      key: 'admin.paymentPrograms.scheduleImpactNamedDuration',
      fallback: 'If this schedule is assigned to {{name}}, they will receive {{money}} {{every}}, for {{days}} days.',
    };
  }
  if (days) {
    return {
      key: 'admin.paymentPrograms.scheduleImpactDuration',
      fallback: 'If this schedule is assigned to an agent, they will receive {{money}} {{every}}, for {{days}} days.',
    };
  }
  if (name) {
    return {
      key: 'admin.paymentPrograms.scheduleImpactNamed',
      fallback: 'If this schedule is assigned to {{name}}, they will receive {{money}} {{every}}.',
    };
  }
  return {
    key: 'admin.paymentPrograms.scheduleImpact',
    fallback: 'If this schedule is assigned to an agent, they will receive {{money}} {{every}}.',
  };
}

function scheduleVars(
  t: Translate,
  input: { frequency: string; days?: string; name?: string },
  money: string
): Record<string, string> {
  return {
    name: input.name?.trim() || '',
    money,
    every: everyLabel(t, input.frequency),
    days: String(Number(input.days) || ''),
  };
}

export function advanceImpact(
  t: Translate,
  input: { amount: string; currency: string; name?: string; locale: string }
): string {
  const money = formatProgramMoney(input.amount, input.currency, input.locale);
  if (!money) return t('admin.paymentPrograms.needAmount', 'Enter an amount to see what an agent would receive.');
  const name = input.name?.trim();
  if (name) {
    return t(
      'admin.paymentPrograms.advanceImpactNamed',
      '{{name}} can draw up to {{money}}. Deposits repay that debt first.',
      { name, money }
    );
  }
  return t(
    'admin.paymentPrograms.advanceImpact',
    'An agent on this program can draw up to {{money}}. Deposits repay that debt first.',
    { money }
  );
}

export function creditImpact(
  t: Translate,
  input: {
    amount: string;
    currency: string;
    scope: string;
    storeName?: string;
    clientName?: string;
    locale: string;
  }
): string {
  const money = formatProgramMoney(input.amount, input.currency, input.locale);
  if (!money) return t('admin.paymentPrograms.needAmount', 'Enter an amount to see what an agent would receive.');
  if (input.scope === 'specific_business' && !input.storeName) {
    return t('admin.paymentPrograms.needStore', 'Choose a partner store to see where this credit applies.');
  }
  return t(
    'admin.paymentPrograms.creditImpact',
    '{{who}} receives {{money}} of store credit {{where}}. It cannot be withdrawn and does not cover the reservation deposit.',
    { who: whoLabel(t, input.clientName), money, where: whereLabel(t, input.scope, input.storeName) }
  );
}

function everyLabel(t: Translate, frequency: string): string {
  const pair = EVERY[frequency] || EVERY.weekly;
  return t(pair[0], pair[1]);
}

function whoLabel(t: Translate, name?: string): string {
  const trimmed = name?.trim();
  return trimmed || t('admin.paymentPrograms.thisClient', 'This client');
}

function whereLabel(t: Translate, scope: string, storeName?: string): string {
  if (scope === 'partner_businesses') {
    return t('admin.paymentPrograms.wherePartners', 'at partner stores');
  }
  if (scope === 'specific_business') {
    return t('admin.paymentPrograms.whereStore', 'at {{store}}', { store: storeName || '' });
  }
  return t('admin.paymentPrograms.whereAny', 'at any store');
}
