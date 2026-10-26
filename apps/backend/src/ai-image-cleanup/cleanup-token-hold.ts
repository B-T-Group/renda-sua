/** Outstanding cleanup reservation. Free tokens were spent first. */
export type CleanupTokenHold = {
  tokens_reserved: number;
  tokens_consumed: number;
  tokens_refunded: number;
  nongiftable_reserved: number;
};

export function tokenHoldFromJob(job: {
  tokens_reserved?: number | null;
  tokens_consumed?: number | null;
  tokens_refunded?: number | null;
  nongiftable_reserved?: number | null;
}): CleanupTokenHold {
  return {
    tokens_reserved: job.tokens_reserved ?? 0,
    tokens_consumed: job.tokens_consumed ?? 0,
    tokens_refunded: job.tokens_refunded ?? 0,
    nongiftable_reserved: job.nongiftable_reserved ?? 0,
  };
}

/**
 * Failure refunds return purchased tokens before the signup allotment.
 * Successes burn the free allotment first (see holdAfterConsume).
 */
export function freeTokensToRestore(
  hold: CleanupTokenHold,
  amount: number
): number {
  if (amount <= 0) return 0;
  const freeHeld = Math.max(0, hold.nongiftable_reserved);
  const unsettled = Math.max(
    0,
    hold.tokens_reserved - hold.tokens_consumed - hold.tokens_refunded
  );
  const paidHeld = Math.max(0, unsettled - freeHeld);
  const restorePaid = Math.min(amount, paidHeld);
  return Math.min(freeHeld, Math.max(0, amount - restorePaid));
}

export function holdAfterRefund(
  hold: CleanupTokenHold,
  amount: number,
  restoredFree: number
): CleanupTokenHold {
  return {
    ...hold,
    tokens_refunded: hold.tokens_refunded + amount,
    nongiftable_reserved: Math.max(0, hold.nongiftable_reserved - restoredFree),
  };
}

/** A finished photo consumes the free allotment before purchased tokens. */
export function holdAfterConsume(
  hold: CleanupTokenHold,
  amount: number
): CleanupTokenHold {
  const burnFree = Math.min(Math.max(0, hold.nongiftable_reserved), Math.max(0, amount));
  return {
    ...hold,
    tokens_consumed: hold.tokens_consumed + amount,
    nongiftable_reserved: Math.max(0, hold.nongiftable_reserved - burnFree),
  };
}
