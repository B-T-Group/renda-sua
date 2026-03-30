import { gql } from 'graphql-request';
import { useEffect } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';

export interface CancellationReason {
  id: number;
  value: string;
  display: string;
  rank: number;
  persona: string[];
}

interface CancellationReasonsResponse {
  order_cancellation_reasons: CancellationReason[];
}

const GET_CANCELLATION_REASONS = gql`
  query GetCancellationReasons($persona: String!) {
    order_cancellation_reasons(
      where: { persona: { _contains: [$persona] } }
      order_by: { rank: asc }
    ) {
      id
      value
      display
      rank
      persona
    }
  }
`;

export interface UseCancellationReasonsOptions {
  /** When false, skips fetching until true (e.g. only when a modal is open). Default true. */
  enabled?: boolean;
}

export const useCancellationReasons = (
  persona: 'client' | 'business',
  options?: UseCancellationReasonsOptions
) => {
  const enabled = options?.enabled !== false;
  const { data, loading, error, execute } = useGraphQLRequest<
    CancellationReasonsResponse,
    { persona: string }
  >(GET_CANCELLATION_REASONS, { showLoading: false });

  useEffect(() => {
    if (!enabled) return;
    void execute({ persona });
  }, [enabled, persona, execute]);

  return {
    reasons: data?.order_cancellation_reasons || [],
    loading: enabled ? loading : false,
    error,
  };
};
