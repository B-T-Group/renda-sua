import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface UseAgentHasIdDocumentResult {
  hasIdDocument: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Returns whether the current user (when agent) has at least one upload
 * with document type id_card, passport, or driver_license.
 * Uses backend GET /uploads/me/has-id-document.
 * Used to show "Upload ID" vs "Account under review" on Available Orders.
 */
export const useAgentHasIdDocument = (
  userTypeId: string | undefined
): UseAgentHasIdDocumentResult => {
  const apiClient = useApiClient();
  const [hasIdDocument, setHasIdDocument] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!apiClient || userTypeId !== 'agent') {
      setHasIdDocument(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{ hasIdDocument: boolean }>(
        '/uploads/me/has-id-document'
      );
      setHasIdDocument(response.data?.hasIdDocument ?? false);
    } catch (err: any) {
      console.error('Error checking agent ID document:', err);
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to check');
      setHasIdDocument(false);
    } finally {
      setLoading(false);
    }
  }, [apiClient, userTypeId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (userTypeId !== 'agent') {
    return { hasIdDocument: false, loading: false, error: null };
  }

  return { hasIdDocument, loading, error };
};
