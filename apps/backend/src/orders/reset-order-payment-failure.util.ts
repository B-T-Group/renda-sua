type HasuraMutator = {
  executeMutation<T = unknown>(
    mutation: string,
    variables?: Record<string, unknown>
  ): Promise<T>;
};

/** Statuses a late retry must not overwrite when clearing a stale failure. */
export const PAYMENT_STATUSES_THAT_BLOCK_FAILURE_RESET = [
  'paid',
  'authorized',
  'refunded',
  'partially_refunded',
] as const;

export const RESET_PAYMENT_FAILURE_MUTATION = `
  mutation ResetPaymentFailure(
    $orderId: uuid!
    $paymentStatus: String!
    $at: timestamptz!
    $blockedStatuses: [String!]!
  ) {
    update_orders(
      where: {
        id: { _eq: $orderId }
        payment_status: { _nin: $blockedStatuses }
      }
      _set: {
        payment_status: $paymentStatus
        payment_failed_at: null
        payment_failure_message: null
        updated_at: $at
      }
    ) {
      affected_rows
    }
  }
`;

export function paymentFailureResetVariables(
  orderId: string,
  at: string
): Record<string, unknown> {
  return {
    orderId,
    paymentStatus: 'pending',
    at,
    blockedStatuses: [...PAYMENT_STATUSES_THAT_BLOCK_FAILURE_RESET],
  };
}

/** Clear failed/pending failure flags without regressing a successful payment. */
export async function resetOrderPaymentFailure(
  hasura: HasuraMutator,
  orderId: string,
  now = () => new Date().toISOString()
): Promise<void> {
  await hasura.executeMutation(
    RESET_PAYMENT_FAILURE_MUTATION,
    paymentFailureResetVariables(orderId, now())
  );
}
