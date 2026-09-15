export type ReelCreditPackId = 'reel_pack_5' | 'reel_pack_20' | 'reel_pack_50';

export interface ReelCreditPack {
  id: ReelCreditPackId;
  credits: number;
  prices: { CAD: number; XAF: number };
}

/** Pricing informed by CloudFront egress (~8MB/view); conservative v1 packs. */
export const REEL_CREDIT_PACKS: ReelCreditPack[] = [
  { id: 'reel_pack_5', credits: 5, prices: { CAD: 9, XAF: 3600 } },
  { id: 'reel_pack_20', credits: 20, prices: { CAD: 29, XAF: 11600 } },
  { id: 'reel_pack_50', credits: 50, prices: { CAD: 59, XAF: 23600 } },
];

export const BOOST_CREDITS_PER_DAY = 1;
export const BOOST_DURATION_HOURS = 24;

export function getReelCreditPack(packId: string): ReelCreditPack | undefined {
  return REEL_CREDIT_PACKS.find((p) => p.id === packId);
}

export function reelPackPriceForCurrency(
  pack: ReelCreditPack,
  currency: string
): number | null {
  const code = currency.toUpperCase();
  if (code === 'CAD' || code === 'XAF') return pack.prices[code];
  return null;
}
