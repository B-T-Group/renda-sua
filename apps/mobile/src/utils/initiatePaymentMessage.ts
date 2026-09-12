import type { InitiateMobilePaymentResponse } from '../types/accountWallet';

/** Prefer the API `message`, then Freemopay-style `data.message`. */
export function initiatePaymentUserMessage(
  res: Pick<InitiateMobilePaymentResponse, 'message' | 'data'>
): string | undefined {
  const top = res.message?.trim();
  if (top) return top;
  const nested = res.data?.message?.trim();
  return nested || undefined;
}
