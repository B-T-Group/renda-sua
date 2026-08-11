import { createHash } from 'crypto';

/** Deterministic UUID for account_transactions.reference_id (uuid column). */
export function referralReferenceUuid(seed: string): string {
  const hash = createHash('sha256').update(seed, 'utf8').digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export type ReferralEntityKind = 'agent' | 'business';

export interface ReferralEntityRef {
  kind: ReferralEntityKind;
  id: string;
  name: string;
  userId: string;
}

export interface PyramidPercents {
  gen1: number;
  gen2: number;
  gen3: number;
}

export interface BonusShareAmount {
  generation: 0 | 1 | 2 | 3;
  amount: number;
}

/** Split gross into earner remainder + upline shares. Remainder stays with earner. */
export function splitReferralBonus(
  gross: number,
  percents: PyramidPercents,
  ancestorCount: number
): BonusShareAmount[] {
  if (gross <= 0) return [];
  const depth = Math.max(0, Math.min(3, Math.floor(ancestorCount)));
  const rates = [percents.gen1, percents.gen2, percents.gen3].slice(0, depth);
  const shares: BonusShareAmount[] = [];
  let allocated = 0;
  for (let i = 0; i < rates.length; i++) {
    const raw = Math.floor((gross * rates[i]) / 100);
    const amount = Math.min(raw, Math.max(0, gross - allocated));
    if (amount > 0) {
      shares.push({ generation: (i + 1) as 1 | 2 | 3, amount });
      allocated += amount;
    }
  }
  const earnerAmount = Math.max(0, gross - allocated);
  shares.unshift({ generation: 0, amount: earnerAmount });
  return shares.filter((s) => s.amount > 0);
}

export function buildReferralBonusMemo(params: {
  generation: 0 | 1 | 2 | 3;
  percent?: number;
  earnerName: string;
  referredKind: ReferralEntityKind;
  referredName: string;
  referredId: string;
}): string {
  const kindLabel = params.referredKind === 'agent' ? 'Agent' : 'Business';
  const referred = `${kindLabel} "${params.referredName}" (${params.referredId})`;
  if (params.generation === 0) {
    return `Referral bonus for referring ${referred}`;
  }
  const level = params.generation;
  const pct = params.percent ?? [5, 3, 1][level - 1];
  return `Referral pyramid L${level} (${pct}%) from ${params.earnerName}'s bonus for referring ${referred}`;
}
