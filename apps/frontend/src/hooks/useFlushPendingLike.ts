import { useEffect, useRef, useState } from 'react';
import { useSessionAuth } from '../contexts/SessionAuthContext';
import {
  clearPendingLikeItemId,
  consumePendingLikeItemId,
  peekPendingLikeItemId,
} from '../utils/pendingLikeItemId';
import { useApiClient } from './useApiClient';

const MAX_FLUSH_RETRIES = 3;

/** After login/signup, persist a like the guest started before auth. */
export function useFlushPendingLike() {
  const { isAuthenticated } = useSessionAuth();
  const apiClient = useApiClient();
  const flushedIdRef = useRef<string | null>(null);
  const retriesRef = useRef(0);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      flushedIdRef.current = null;
      retriesRef.current = 0;
      return;
    }
    const pending = peekPendingLikeItemId();
    if (!pending || flushedIdRef.current === pending) return;
    flushedIdRef.current = pending;
    void apiClient
      .put(`/item-likes/${pending}`, { liked: true })
      .then(() => {
        consumePendingLikeItemId();
        retriesRef.current = 0;
      })
      .catch((error: any) => {
        const status = error?.response?.status;
        if (status === 404 || status === 401 || retriesRef.current >= MAX_FLUSH_RETRIES) {
          clearPendingLikeItemId();
          retriesRef.current = 0;
          flushedIdRef.current = null;
          return;
        }
        retriesRef.current += 1;
        flushedIdRef.current = null;
        window.setTimeout(() => setRetryToken((n) => n + 1), 1500);
      });
  }, [isAuthenticated, apiClient, retryToken]);
}
