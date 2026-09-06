import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/apiClient';

type AgentStatus = 'active' | 'suspended';

export type IdDocumentStatus = 'missing' | 'pending' | 'rejected' | 'approved';

export interface AgentVerificationStatus {
  agentStatus: AgentStatus;
  isVerified: boolean;
  hasIdDocument: boolean;
  idDocumentStatus: IdDocumentStatus;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAgentVerificationStatus(): AgentVerificationStatus {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('active');
  const [isVerified, setIsVerified] = useState(false);
  const [hasIdDocument, setHasIdDocument] = useState(false);
  const [idDocumentStatus, setIdDocumentStatus] = useState<IdDocumentStatus>('missing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, idRes] = await Promise.all([
        api.get<{
          success: boolean;
          user?: { agent?: { is_verified: boolean; status?: AgentStatus | null } };
        }>('/users/me'),
        api.get<{
          hasIdDocument: boolean;
          idDocumentStatus?: IdDocumentStatus;
        }>('/uploads/me/has-id-document'),
      ]);

      const agent = meRes?.user?.agent;
      setIsVerified(!!agent?.is_verified);
      setAgentStatus((agent?.status ?? 'active') as AgentStatus);

      const hasDoc = !!idRes?.hasIdDocument;
      setHasIdDocument(hasDoc);
      setIdDocumentStatus(
        idRes?.idDocumentStatus ?? (hasDoc ? 'pending' : 'missing')
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setError(msg);
      setIsVerified(false);
      setHasIdDocument(false);
      setIdDocumentStatus('missing');
      setAgentStatus('active');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    agentStatus,
    isVerified,
    hasIdDocument,
    idDocumentStatus,
    loading,
    error,
    refetch: fetch,
  };
}
