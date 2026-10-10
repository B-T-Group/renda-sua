import type { ObjectiveProgress } from '../components/agent/objectiveProgress';
import type {
  EarningItem,
  MerchantReferralStructure,
  PaymentScheduleStructure,
  ScheduleObjectiveView,
} from '../types/agentPayBoard';

const EMPTY_METRIC = { actual: 0, target: null, percent: null };

export function isMerchantItem(
  item: EarningItem
): item is EarningItem & { structure: MerchantReferralStructure } {
  return item.structure.type === 'merchant_referral';
}

export function isScheduleItem(
  item: EarningItem
): item is EarningItem & { structure: PaymentScheduleStructure } {
  return item.structure.type === 'payment_schedule';
}

export function progressFromObjectives(objectives: ScheduleObjectiveView[]): ObjectiveProgress {
  const progress = blankProgress();
  for (const row of objectives) {
    progress[row.key] = { actual: row.actual, target: row.target, percent: row.percent };
  }
  progress.overallPercent = overallPercent(objectives);
  return progress;
}

export function itemsForSegment(items: EarningItem[], segment: 'commissions' | 'objectives') {
  if (segment === 'objectives') return items.filter(isScheduleItem);
  return items.filter((item) => !isScheduleItem(item));
}

function blankProgress(): ObjectiveProgress {
  return {
    itemSales: { ...EMPTY_METRIC },
    rentals: { ...EMPTY_METRIC },
    clientSignups: { ...EMPTY_METRIC },
    merchantRecruitments: { ...EMPTY_METRIC },
    agentRecruitments: { ...EMPTY_METRIC },
    completionPercent: null,
    overallPercent: null,
    nextObjective: null,
  };
}

function overallPercent(objectives: ScheduleObjectiveView[]): number | null {
  if (!objectives.length) return null;
  const total = objectives.reduce((sum, row) => sum + row.percent, 0);
  return Math.round(total / objectives.length);
}
