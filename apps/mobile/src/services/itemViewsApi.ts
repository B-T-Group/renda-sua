/**
 * Item-view tracking against the Rendasua Nest API (`POST /track-view`).
 * Authenticated viewers are resolved from the bearer token; guests are
 * identified by a stable per-install anonymous id.
 *
 * Pass `eventId` only for intentional product views (detail) so Meta CAPI
 * ViewContent is emitted server-side.
 */

import { Platform } from 'react-native';
import { getOrCreateRsAnonymousId } from '../utils/rsAnonymousId';
import { api } from './apiClient';
import { publicApiPost } from './publicApiClient';

export type TrackItemViewOptions = {
  eventId?: string;
  value?: number;
  currency?: string;
  contentName?: string;
};

export async function trackItemView(
  itemId: string,
  isAuthenticated: boolean,
  options?: TrackItemViewOptions
): Promise<void> {
  const body = {
    itemId,
    ...(options?.eventId && { eventId: options.eventId }),
    ...(options?.value != null && { value: options.value }),
    ...(options?.currency && { currency: options.currency }),
    ...(options?.contentName && { contentName: options.contentName }),
  };
  const headers: Record<string, string> = {
    'x-rendasua-platform': Platform.OS,
  };
  if (isAuthenticated) {
    await api.post('/track-view', body, { headers });
    return;
  }
  const anonId = await getOrCreateRsAnonymousId();
  await publicApiPost('/track-view', body, {
    headers: { ...headers, 'X-Anonymous-Id': anonId },
  });
}
