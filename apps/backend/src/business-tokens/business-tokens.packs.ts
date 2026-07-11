export type TokenPackId = 'pack_100' | 'pack_1000' | 'pack_5000';

export interface TokenPack {
  id: TokenPackId;
  tokens: number;
  prices: { CAD: number; XAF: number };
}

export const TOKEN_PACKS: TokenPack[] = [
  { id: 'pack_100', tokens: 100, prices: { CAD: 2, XAF: 800 } },
  { id: 'pack_1000', tokens: 1000, prices: { CAD: 15, XAF: 6000 } },
  { id: 'pack_5000', tokens: 5000, prices: { CAD: 50, XAF: 20000 } },
];

export const SIGNUP_AI_TOKENS = 20;
export const SUPER_USER_AI_TOKENS = 1000;
export const CLEANUP_TOKEN_COST = 1;

export function getTokenPack(packId: string): TokenPack | undefined {
  return TOKEN_PACKS.find((pack) => pack.id === packId);
}

export function findPackByAmount(
  amount: number,
  currency: string
): TokenPack | undefined {
  const code = currency.toUpperCase() as 'CAD' | 'XAF';
  return TOKEN_PACKS.find((pack) => {
    const price = pack.prices[code];
    return price !== undefined && Math.abs(price - amount) < 0.001;
  });
}

export function findPackByDescription(
  description: string | null | undefined
): TokenPack | undefined {
  if (!description) return undefined;
  const match = description.match(/AI tokens(?: pack)?\s+(\d+)/i);
  if (!match) return undefined;
  const tokens = Number.parseInt(match[1], 10);
  return TOKEN_PACKS.find((pack) => pack.tokens === tokens);
}

export function resolvePurchasedPack(params: {
  amount: number;
  currency: string;
  description?: string | null;
}): TokenPack | undefined {
  return (
    findPackByAmount(params.amount, params.currency) ||
    findPackByDescription(params.description)
  );
}

export function packPriceForCurrency(
  pack: TokenPack,
  currency: string
): number | null {
  const code = currency.toUpperCase();
  if (code === 'CAD' || code === 'XAF') {
    return pack.prices[code];
  }
  return null;
}
