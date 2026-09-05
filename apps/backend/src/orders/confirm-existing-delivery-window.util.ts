/**
 * Confirming a scheduled order writes `is_confirmed` on the delivery window
 * before later steps (food stock, status). Those can fail after the window
 * row is already confirmed. Retry must reuse that row for the same order.
 */
export function shouldReuseConfirmedDeliveryWindow(params: {
  windowOrderId: string | null | undefined;
  requestOrderId: string;
  isConfirmed: boolean;
}): boolean {
  if (!params.isConfirmed) return false;
  return params.windowOrderId === params.requestOrderId;
}
