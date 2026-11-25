/** Server code when the renter has not seen a changed rental price yet (409). */
export const PRICE_CHANGE_UNSEEN = 'PRICE_CHANGE_UNSEEN';

export const PRICE_CHANGE_UNSEEN_KEY = 'rentals.clientRequests.priceChangeUnseenError';
export const PRICE_CHANGE_UNSEEN_TEXT =
  'The business changed the price. Check the new total on your request, then try again.';

export function isPriceChangeUnseenError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const data = (err as { response?: { data?: { message?: unknown; code?: unknown } } }).response
    ?.data;
  return data?.message === PRICE_CHANGE_UNSEEN || data?.code === PRICE_CHANGE_UNSEEN;
}
