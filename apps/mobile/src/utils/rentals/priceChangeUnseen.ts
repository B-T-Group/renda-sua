/** Server code when the renter has not seen a changed rental price yet (409). */
export const PRICE_CHANGE_UNSEEN = 'PRICE_CHANGE_UNSEEN';

export const PRICE_CHANGE_UNSEEN_KEY = 'rentals.clientRequests.priceChangeUnseenError';
export const PRICE_CHANGE_UNSEEN_TEXT =
  'The business changed the price. Check the new total on your request, then try again.';

export function isPriceChangeUnseenError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    message?: unknown;
    code?: unknown;
    data?: { message?: unknown; code?: unknown } | null;
  };
  return [e.message, e.code, e.data?.message, e.data?.code].some((v) => v === PRICE_CHANGE_UNSEEN);
}
