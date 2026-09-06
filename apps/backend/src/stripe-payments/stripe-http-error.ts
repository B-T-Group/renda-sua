import { HttpException, HttpStatus } from '@nestjs/common';

type StripeLikeError = {
  statusCode?: number;
  message?: string;
  raw?: { message?: string; statusCode?: number };
};

export function stripeStatusCode(error: unknown): number | undefined {
  const err = error as StripeLikeError;
  const status = Number(err?.statusCode ?? err?.raw?.statusCode);
  return Number.isFinite(status) && status > 0 ? status : undefined;
}

export function stripeErrorMessage(error: unknown): string {
  const err = error as StripeLikeError;
  const message = err?.raw?.message || err?.message;
  return typeof message === 'string' && message.trim()
    ? message.trim()
    : 'Stripe request failed';
}

export function httpExceptionFromStripeError(error: unknown): HttpException {
  const message = stripeErrorMessage(error);
  const stripeStatus = stripeStatusCode(error);
  const status =
    stripeStatus && stripeStatus >= 400 && stripeStatus < 500
      ? HttpStatus.BAD_REQUEST
      : HttpStatus.BAD_GATEWAY;
  return new HttpException(
    { success: false, error: message, message },
    status,
    { cause: error instanceof Error ? error : undefined }
  );
}

/** Stripe rejects empty or malformed receipt_email / customer_email with HTTP 400. */
export function usableCustomerEmail(email?: string): string | undefined {
  const value = email?.trim();
  if (!value) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : undefined;
}
