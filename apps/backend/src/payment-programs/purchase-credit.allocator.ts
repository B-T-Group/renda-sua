export type CreditApplicability =
  | 'any_store'
  | 'partner_businesses'
  | 'specific_business';

export interface CreditLine {
  businessId: string;
  subtotal: number;
}

export interface CreditGrantInput {
  id: string;
  remainingAmount: number;
  applicability: CreditApplicability;
  businessId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreditAllocation {
  grantId: string;
  amount: number;
  applicability: CreditApplicability;
  businessId: string | null;
}

const SPECIFICITY: Record<CreditApplicability, number> = {
  specific_business: 0,
  partner_businesses: 1,
  any_store: 2,
};

function money(value: number): number {
  return Number(value.toFixed(2));
}

function isExpired(expiresAt: string | null, now: Date): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() <= now.getTime();
}

function grantMatchesLine(
  grant: CreditGrantInput,
  businessId: string,
  partnerBusinessIds: ReadonlySet<string>
): boolean {
  if (grant.applicability === 'specific_business') {
    return grant.businessId === businessId;
  }
  if (grant.applicability === 'partner_businesses') {
    return partnerBusinessIds.has(businessId);
  }
  return true;
}

function compareGrants(a: CreditGrantInput, b: CreditGrantInput): number {
  const rank = SPECIFICITY[a.applicability] - SPECIFICITY[b.applicability];
  if (rank !== 0) return rank;
  const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aExp !== bExp) return aExp - bExp;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function allocatePurchaseCredits(params: {
  lines: CreditLine[];
  grants: CreditGrantInput[];
  partnerBusinessIds: ReadonlySet<string>;
  maxTotal: number;
  now?: Date;
}): { allocations: CreditAllocation[]; total: number } {
  const now = params.now ?? new Date();
  const remainingByLine = params.lines.map((line) => money(Math.max(0, line.subtotal)));
  const grants = params.grants
    .filter((grant) => grant.remainingAmount > 0 && !isExpired(grant.expiresAt, now))
    .slice()
    .sort(compareGrants);
  const taken = new Map<string, number>();
  let total = 0;

  for (const grant of grants) {
    let left = money(grant.remainingAmount);
    for (let i = 0; i < params.lines.length && left > 0 && total < params.maxTotal; i++) {
      if (!grantMatchesLine(grant, params.lines[i].businessId, params.partnerBusinessIds)) {
        continue;
      }
      const room = money(Math.min(remainingByLine[i], left, params.maxTotal - total));
      if (room <= 0) continue;
      remainingByLine[i] = money(remainingByLine[i] - room);
      left = money(left - room);
      total = money(total + room);
      taken.set(grant.id, money((taken.get(grant.id) ?? 0) + room));
    }
  }

  return {
    total,
    allocations: [...taken.entries()].map(([grantId, amount]) => {
      const grant = grants.find((row) => row.id === grantId);
      return {
        grantId,
        amount,
        applicability: grant?.applicability ?? 'any_store',
        businessId: grant?.businessId ?? null,
      };
    }),
  };
}
