import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchAuthenticatedStoreBrowseContext,
  fetchPublicStoreBrowseContext,
  type StoreBrowseContext,
} from '../services/inventoryItemsApi';

export function useStoreBrowseContext(options: {
  businessId?: string;
  foodOnly?: boolean;
  ownerPreview?: boolean;
  withAuth?: boolean;
  enabled?: boolean;
}) {
  const { i18n } = useTranslation();
  const [context, setContext] = useState<StoreBrowseContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const enabled =
    options.enabled !== false && Boolean(options.businessId?.trim());
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const refetch = useCallback(async () => {
    if (!enabled || !options.businessId?.trim()) {
      setContext(null);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const fetchOne =
        options.withAuth || options.ownerPreview
          ? fetchAuthenticatedStoreBrowseContext
          : fetchPublicStoreBrowseContext;
      const envelope = await fetchOne(
        options.businessId.trim(),
        {
          lang,
          ...(options.foodOnly && { food_only: true }),
          ...(options.ownerPreview && { owner_preview: true }),
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      if (!envelope.success) {
        setContext(null);
        setError(envelope.message || 'Failed to load store browse context');
        return;
      }
      setContext(envelope.data);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      setContext(null);
      setError(
        e instanceof Error ? e.message : 'Failed to load store browse context'
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    enabled,
    lang,
    options.businessId,
    options.foodOnly,
    options.ownerPreview,
    options.withAuth,
  ]);

  useEffect(() => {
    void refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  return { context, loading, error, refetch };
}
