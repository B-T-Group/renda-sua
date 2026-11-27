import { pickupDirectionsUrl } from './pickupDirectionsUrl';

type Translate = (key: string, fallback: string, vars?: Record<string, string>) => string;

/** Sticky-card props that turn the pickup address line into a directions link. */
export function pickupAddressLink(address: string | null | undefined, t: Translate) {
  const text = address?.trim();
  if (!text) return {};
  return {
    summaryDetail: text,
    summaryDetailHref: pickupDirectionsUrl(text),
    summaryDetailLinkLabel: t('rentals.start.directionsTo', 'Get directions to {{address}}', { address: text }),
  };
}
