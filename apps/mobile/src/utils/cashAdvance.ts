/** Remaining drawable amount on a cash-advance facility. */
export function drawableRemaining(
  limitAmount: number | string | null | undefined,
  cashAdvanceBalance: number | string | null | undefined
): number {
  const limit = Number(limitAmount);
  const owed = Math.abs(Number(cashAdvanceBalance ?? 0));
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  if (!Number.isFinite(owed)) return Math.max(0, limit);
  return Math.max(0, limit - owed);
}

export function cashAdvanceOwed(
  cashAdvanceBalance: number | string | null | undefined
): number {
  const owed = Math.abs(Number(cashAdvanceBalance ?? 0));
  return Number.isFinite(owed) ? owed : 0;
}
