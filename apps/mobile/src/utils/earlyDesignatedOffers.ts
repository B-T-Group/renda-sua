import type { DesignatedOffer } from '../types/designated';

/** Early designated offers for Home: pre-gate, not Home-ignored. */
export function earlyDesignatedOffers(offers: DesignatedOffer[] | null | undefined): DesignatedOffer[] {
  return (offers ?? []).filter((o) => o.phase === 'early' && !o.dismissedFromHome);
}
