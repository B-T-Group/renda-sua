export interface PortfolioPaidSums {
  creditedPayable: number;
  creditedRecruitment: number;
  openPayable: number;
  openRecruitment: number;
  releasedHolds: number;
}

interface SumPair {
  payable_amount?: unknown;
  recruitment_amount?: unknown;
}

export interface PortfolioPaidQueryResult {
  credited?: { aggregate?: { sum?: SumPair | null } | null } | null;
  open?: { aggregate?: { sum?: SumPair | null } | null } | null;
  holds?: { aggregate?: { sum?: { amount?: unknown } | null } | null } | null;
}

export function readPortfolioSums(
  result: PortfolioPaidQueryResult | null | undefined
): PortfolioPaidSums {
  const credited = result?.credited?.aggregate?.sum;
  const open = result?.open?.aggregate?.sum;
  return {
    creditedPayable: amount(credited?.payable_amount),
    creditedRecruitment: amount(credited?.recruitment_amount),
    openPayable: amount(open?.payable_amount),
    openRecruitment: amount(open?.recruitment_amount),
    releasedHolds: amount(result?.holds?.aggregate?.sum?.amount),
  };
}

export function portfolioTotalsFromSums(
  sums: PortfolioPaidSums,
  livePending: number
): { earned: number; pending: number } | null {
  const earned = sums.creditedPayable + sums.creditedRecruitment + sums.releasedHolds;
  const pending = sums.openPayable + sums.openRecruitment + livePending;
  if (earned <= 0 && pending <= 0) return null;
  return { earned, pending };
}

export function livePortfolioPending(
  stored: boolean,
  month: { status: string; payableAmount: number; recruitmentAmount: number } | null
): number {
  if (stored || month?.status !== 'open') return 0;
  return month.payableAmount + month.recruitmentAmount;
}

function amount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
