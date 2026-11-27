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

/** Sticky-card props that turn the pickup address line into a directions link. */
export function pickupAddressLink(address: string | null | undefined, t: Translate) {
  const text = address?.trim();
  if (!text) return {};
  return {
    summaryDetail: text,
    onSummaryDetailPress: () => void openPickupDirections(text),
    summaryDetailAccessibilityLabel: t('rentals.start.directionsTo', 'Get directions to {{address}}', { address: text }),
  };
}
