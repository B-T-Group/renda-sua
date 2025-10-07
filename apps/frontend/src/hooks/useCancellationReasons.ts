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

export const useCancellationReasons = (persona: 'client' | 'business') => {
  const { data, loading, error, execute } = useGraphQLRequest<
    CancellationReasonsResponse,
    { persona: string }
  >(GET_CANCELLATION_REASONS, { showLoading: false });

  useEffect(() => {
    execute({ persona });
  }, [persona, execute]);

  return {
    reasons: data?.order_cancellation_reasons || [],
    loading,
    error,
  };
};
