import { useCallback, useRef } from 'react';
import { useStore } from '../stores/RootStore';
import {
  trackItemView,
  type TrackItemViewOptions,
} from '../services/itemViewsApi';

function newMetaEventId(): string {
  return `meta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Fire-and-forget item-view tracking. Deduplicates per inventory item for the
 * lifetime of the consuming component so repeated interactions (e.g. tapping
 * "Buy") only register a single view.
 *
 * Pass `forMetaViewContent: true` (or an explicit eventId) on product detail
 * so Nest emits Meta CAPI ViewContent.
 */
export function useTrackItemView() {
  const { auth } = useStore();
  const trackedRef = useRef<Record<string, boolean>>({});
  const metaViewTrackedRef = useRef<Record<string, boolean>>({});

  const trackView = useCallback(
    (
      itemId?: string | null,
      options?: TrackItemViewOptions & { forMetaViewContent?: boolean }
    ) => {
      if (!itemId) return;

      const wantsMeta =
        !!options?.eventId || !!options?.forMetaViewContent;
      if (wantsMeta) {
        if (metaViewTrackedRef.current[itemId]) return;
        metaViewTrackedRef.current[itemId] = true;
      } else if (trackedRef.current[itemId]) {
        return;
      }
      trackedRef.current[itemId] = true;

      const payload: TrackItemViewOptions = {
        ...(options?.value != null && { value: options.value }),
        ...(options?.currency && { currency: options.currency }),
        ...(options?.contentName && { contentName: options.contentName }),
      };
      if (options?.eventId) {
        payload.eventId = options.eventId;
      } else if (options?.forMetaViewContent) {
        payload.eventId = newMetaEventId();
      }

      void trackItemView(itemId, auth.isAuthenticated, payload).catch(() => {
        trackedRef.current[itemId] = false;
        if (wantsMeta) metaViewTrackedRef.current[itemId] = false;
      });
    },
    [auth.isAuthenticated]
  );

  return { trackView };
}
