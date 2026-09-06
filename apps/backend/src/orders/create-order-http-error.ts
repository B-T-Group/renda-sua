import { HttpException, HttpStatus } from '@nestjs/common';
import { stripeStatusCode } from '../stripe-payments/stripe-http-error';

const CLIENT_ERROR_MARKERS = [
  'MERCHANT_NOT_ACCEPTING_ORDERS',
  'No valid items found',
  'Item',
  'No account found',
  'Insufficient',
];

export function toCreateOrderHttpException(error: any): HttpException {
  if (error instanceof HttpException) return error;
  const errorMessage = error?.message || 'Internal server error';
  return new HttpException(
    { success: false, error: errorMessage, message: errorMessage },
    resolveCreateOrderStatus(error, errorMessage)
  );
}

function resolveCreateOrderStatus(error: any, errorMessage: string): number {
  const stripeStatus = stripeStatusCode(error);
  if (stripeStatus && stripeStatus >= 400 && stripeStatus < 500) {
    return HttpStatus.BAD_REQUEST;
  }
  if (errorMessage.includes('User not found')) return HttpStatus.NOT_FOUND;
  if (CLIENT_ERROR_MARKERS.some((marker) => errorMessage.includes(marker))) {
    return HttpStatus.BAD_REQUEST;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}
