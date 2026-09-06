import { gql } from '@apollo/client';
import { getClient } from './apolloClient';

export interface CancellationReason {
  id: number;
  value: string;
  display: string;
  rank: number;
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
    }
  }
`;

export async function fetchBusinessCancellationReasons(): Promise<CancellationReason[]> {
  const client = getClient();
  const res = await client.query<{
    order_cancellation_reasons: CancellationReason[];
  }>({
    query: GET_CANCELLATION_REASONS,
    variables: { persona: 'business' },
    fetchPolicy: 'network-only',
  });
  return res.data?.order_cancellation_reasons ?? [];
}
