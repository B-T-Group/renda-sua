import { Linking, Platform } from 'react-native';
import { pickupDirectionsUrls } from './pickupDirectionsUrl';

export async function openPickupDirections(address: string): Promise<void> {
  const { primary, fallback } = pickupDirectionsUrls(address, Platform.OS);
  try {
    await Linking.openURL(primary);
  } catch {
    if (primary !== fallback) await Linking.openURL(fallback).catch(() => undefined);
  }
}

type Translate = (key: string, fallback: string, vars?: Record<string, string>) => string;

/** Sticky-card props: the address stays plain text and the place name opens directions to it. */
export function pickupPlaceLink(place: string, address: string | null | undefined, t: Translate) {
  const text = address?.trim();
  if (!text) return {};
  return {
    summaryDetail: text,
    onSummaryValuePress: () => void openPickupDirections(text),
    summaryValueAccessibilityLabel: t('rentals.start.directionsTo', 'Get directions to {{name}}', { name: place }),
  };
}
