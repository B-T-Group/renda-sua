import type { TFunction } from 'i18next';
import type { AuthGateContextKey } from '../types/authGate';

export function getAuthGateSuccessToast(
  context: AuthGateContextKey
): { key: string; defaultValue: string } | null {
  switch (context) {
    case 'favorites':
      return {
        key: 'auth.gate.success.favorites',
        defaultValue: 'Saved to favorites',
      };
    case 'interest':
      return {
        key: 'auth.gate.success.interest',
        defaultValue: "The seller knows you're interested",
      };
    case 'foods_cart':
      return {
        key: 'auth.gate.success.foodsCart',
        defaultValue: 'Added to cart',
      };
    default:
      return null;
  }
}

function isSoldOutIntentError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as {
    message?: string;
    response?: { data?: { message?: string; error?: string; code?: string } };
  };
  const msg = (
    err.response?.data?.message ||
    err.response?.data?.error ||
    err.message ||
    ''
  ).toLowerCase();
  const code = String(err.response?.data?.code || '').toLowerCase();
  return (
    code.includes('sold_out') ||
    msg.includes('sold out') ||
    msg.includes('no longer available') ||
    msg.includes("n'est plus disponible")
  );
}

export function getAuthGateIntentErrorMessage(
  error: unknown,
  t: TFunction
): string {
  if (isSoldOutIntentError(error)) {
    return t(
      'auth.gate.intentSoldOut',
      'This item is no longer available.'
    );
  }
  return t(
    'auth.gate.intentFailed',
    "Signed in, but we couldn't finish that. Please try again."
  );
}
