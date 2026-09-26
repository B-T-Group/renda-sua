/**
 * Purchase-credit math shared by place-order / checkout sticky summaries.
 * Credits only apply to item subtotals (not delivery or deposits).
 */

export function appliedPurchaseCredit(input: {
  itemSubtotal: number;
  orderTotal: number;
  creditTotal: number;
  depositNow?: number | null;
}): { applied: number; remaining: number; dueAtFulfillment: number } {
  const cap = Math.min(Math.max(0, input.itemSubtotal), Math.max(0, input.orderTotal));
  const applied = Math.min(Math.max(0, input.creditTotal), cap);
  const remaining = Math.max(0, Number((input.orderTotal - applied).toFixed(2)));
  const deposit = input.depositNow && input.depositNow > 0 ? input.depositNow : 0;
  return {
    applied,
    remaining,
    dueAtFulfillment: Math.max(0, Number((remaining - deposit).toFixed(2))),
  };
}
