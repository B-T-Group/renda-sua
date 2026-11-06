import type { DesignatedOffer } from '../types/designated';

/** Early designated offers (before the dispatch gate) for the agent home list. */
export function earlyDesignatedOffers(offers: DesignatedOffer[] | null | undefined): DesignatedOffer[] {
  return (offers ?? []).filter((o) => o.phase === 'early');
}
