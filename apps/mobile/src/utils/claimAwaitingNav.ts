import type { ClaimAwaitingPaymentParams } from '../navigation/types';
import type { ClaimOrderTopupResponse } from '../types/agent';

export function claimAwaitingParams(input: {
  orderId: string;
  orderNumber?: string;
  phoneE164: string;
  currency?: string;
  response: ClaimOrderTopupResponse;
}): ClaimAwaitingPaymentParams | null {
  const transactionId = input.response.paymentTransaction?.id?.trim();
  if (!transactionId) return null;
  return {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    phoneE164: input.response.phoneNumber || input.phoneE164,
    transactionId,
    currency: input.currency,
  };
}
