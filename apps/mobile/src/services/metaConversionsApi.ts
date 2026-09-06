/**
 * Meta Conversions API client-side track helpers (server CAPI via Nest).
 */

import { Platform } from 'react-native';
import { getOrCreateRsAnonymousId } from '../utils/rsAnonymousId';
import { api } from './apiClient';
import { publicApiPost } from './publicApiClient';

export type TrackAddToCartPayload = {
  inventoryItemId: string;
  quantity?: number;
  value?: number;
  currency?: string;
  contentName?: string;
  eventId?: string;
};

function newEventId(): string {
  return `meta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function trackMetaAddToCart(
  payload: TrackAddToCartPayload,
  isAuthenticated: boolean
): Promise<void> {
  const body = {
    inventoryItemId: payload.inventoryItemId,
    quantity: payload.quantity ?? 1,
    value: payload.value,
    currency: payload.currency,
    contentName: payload.contentName,
    eventId: payload.eventId ?? newEventId(),
  };
  const headers: Record<string, string> = {
    'x-rendasua-platform': Platform.OS,
  };
  if (isAuthenticated) {
    await api.post('/track-add-to-cart', body, { headers });
    return;
  }
  const anonId = await getOrCreateRsAnonymousId();
  await publicApiPost('/track-add-to-cart', body, {
    headers: { ...headers, 'X-Anonymous-Id': anonId },
  });
}

export function scheduleMetaAddToCart(
  payload: TrackAddToCartPayload,
  isAuthenticated: boolean
): void {
  void trackMetaAddToCart(payload, isAuthenticated).catch(() => {
    // never surface tracking errors
  });
}
