export type ObjectiveKey =
  | 'itemSales'
  | 'rentals'
  | 'clientSignups'
  | 'merchantRecruitments'
  | 'agentRecruitments';

export interface ObjectiveMetric {
  actual: number;
  target: number | null;
  percent: number | null;
}

export interface ObjectiveProgress {
  agentRecruitments: ObjectiveMetric;
  clientSignups: ObjectiveMetric;
  merchantRecruitments: ObjectiveMetric;
  itemSales: ObjectiveMetric;
  rentals: ObjectiveMetric;
  completionPercent: number | null;
  overallPercent: number | null;
  nextObjective: ObjectiveKey | null;
}

export const OBJECTIVE_ROWS: Array<{
  key: ObjectiveKey;
  labelKey: string;
  fallback: string;
  money: boolean;
}> = [
  { key: 'itemSales', labelKey: 'accounts.schedules.itemSales', fallback: 'Item sales', money: true },
  { key: 'rentals', labelKey: 'accounts.schedules.rentals', fallback: 'Rentals', money: true },
  {
    key: 'clientSignups',
    labelKey: 'accounts.schedules.clientSignups',
    fallback: 'Client signups',
    money: false,
  },
  {
    key: 'merchantRecruitments',
    labelKey: 'accounts.schedules.merchantRecruitments',
    fallback: 'Merchant recruitments',
    money: false,
  },
  {
    key: 'agentRecruitments',
    labelKey: 'accounts.schedules.agentRecruitments',
    fallback: 'Agent recruitments',
    money: false,
  },
];

type Translator = (
  key: string,
  fallback: string,
  options?: Record<string, unknown>
) => string;

export function formatObjectivePair(
  actual: number,
  target: number,
  money: boolean,
  currency: string
) {
  const left = money ? actual.toLocaleString() : String(actual);
  const right = money ? target.toLocaleString() : String(target);
  return money ? `${left} / ${right} ${currency}` : `${left} / ${right}`;
}

export function objectiveGapLabel(
  key: ObjectiveKey,
  metric: ObjectiveMetric,
  currency: string,
  t: Translator
) {
  const remaining = Math.max(0, (metric.target ?? 0) - metric.actual);
  if (key === 'itemSales' || key === 'rentals') {
    return t(`accounts.schedules.focus.gap.${key}`, moneyGap(key), {
      amount: remaining.toLocaleString(),
      currency,
    });
  }
  const count = Math.max(1, Math.ceil(remaining));
  return t(
    `accounts.schedules.focus.gap.${key}${count === 1 ? 'One' : ''}`,
    countGap(key, count === 1),
    { count }
  );
}

function moneyGap(key: ObjectiveKey) {
  if (key === 'rentals') return 'Next: {{amount}} {{currency}} more in rentals';
  return 'Next: {{amount}} {{currency}} more in item sales';
}

function countGap(key: ObjectiveKey, one: boolean) {
  if (key === 'clientSignups') {
    return one ? 'Next: 1 more client signup' : 'Next: {{count}} more client signups';
  }
  if (key === 'merchantRecruitments') {
    return one
      ? 'Next: 1 more merchant recruitment'
      : 'Next: {{count}} more merchant recruitments';
  }
  return one ? 'Next: 1 more agent recruitment' : 'Next: {{count}} more agent recruitments';
}
