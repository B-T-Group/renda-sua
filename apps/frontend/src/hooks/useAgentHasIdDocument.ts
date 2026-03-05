import { useCallback, useEffect, useState } from 'react';
import { useGraphQLClient } from './useGraphQLClient';

const ID_DOCUMENT_TYPE_NAMES = ['id_card', 'passport', 'driver_license'];

export interface UseAgentHasIdDocumentResult {
  hasIdDocument: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Returns whether the current user (when agent) has at least one upload
 * with document type id_card, passport, or driver_license.
 * Used to show "Upload ID" vs "Account under review" on Available Orders.
 */
export const useAgentHasIdDocument = (
  userId: string | undefined,
  userTypeId: string | undefined
): UseAgentHasIdDocumentResult => {
  const { client } = useGraphQLClient();
  const [hasIdDocument, setHasIdDocument] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!client || !userId || userTypeId !== 'agent') {
      setHasIdDocument(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = `
        query AgentHasIdDocument($userId: uuid!, $documentTypeNames: [String!]) {
          user_uploads(
            where: {
              user_id: { _eq: $userId }
              document_type: { name: { _in: $documentTypeNames } }
            }
            limit: 1
          ) {
            id
          }
        }
      `;
      const response = await client.request<{
        user_uploads: { id: string }[];
      }>(query, {
        userId,
        documentTypeNames: ID_DOCUMENT_TYPE_NAMES,
      });
      setHasIdDocument((response.user_uploads?.length ?? 0) > 0);
    } catch (err) {
      console.error('Error checking agent ID document:', err);
      setError(err instanceof Error ? err.message : 'Failed to check');
      setHasIdDocument(false);
    } finally {
      setLoading(false);
    }
  }, [client, userId, userTypeId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (userTypeId !== 'agent' || !userId) {
    return { hasIdDocument: false, loading: false, error: null };
  }

  return { hasIdDocument, loading, error };
};
