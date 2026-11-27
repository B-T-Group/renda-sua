import { pickupDirectionsUrl } from './pickupDirectionsUrl';

type Translate = (key: string, fallback: string, vars?: Record<string, string>) => string;

/** Sticky-card props: the address stays plain text and the place name links to directions to it. */
export function pickupPlaceLink(place: string, address: string | null | undefined, t: Translate) {
  const text = address?.trim();
  if (!text) return {};
  return {
    summaryDetail: text,
    summaryValueHref: pickupDirectionsUrl(text),
    summaryValueLinkLabel: t('rentals.start.directionsTo', 'Get directions to {{name}}', { name: place }),
  };
}
