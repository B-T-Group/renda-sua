import { HttpStatus } from '@nestjs/common';
import {
  httpExceptionFromStripeError,
  stripeErrorMessage,
  stripeStatusCode,
  usableCustomerEmail,
} from './stripe-http-error';

describe('stripe-http-error', () => {
  it('maps Stripe 4xx invalid requests to HTTP 400 with the Stripe message', () => {
    const exception = httpExceptionFromStripeError({
      statusCode: 400,
      message: 'Invalid integer: 1099.5',
      raw: { message: 'Invalid integer: 1099.5', statusCode: 400 },
    });

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.message).toBe('Invalid integer: 1099.5');
    expect(exception.getResponse()).toEqual({
      success: false,
      error: 'Invalid integer: 1099.5',
      message: 'Invalid integer: 1099.5',
    });
  });

  it('maps Stripe 5xx to HTTP 502', () => {
    const exception = httpExceptionFromStripeError({
      statusCode: 500,
      message: 'An error occurred internally',
    });

    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.message).toBe('An error occurred internally');
  });

  it('reads status and message from the raw Stripe payload', () => {
    expect(
      stripeStatusCode({ raw: { statusCode: 400, message: 'Amount too small' } })
    ).toBe(400);
    expect(
      stripeErrorMessage({ raw: { message: 'Amount too small' } })
    ).toBe('Amount too small');
  });

  it('omits empty or malformed emails Stripe would reject', () => {
    expect(usableCustomerEmail(undefined)).toBeUndefined();
    expect(usableCustomerEmail('')).toBeUndefined();
    expect(usableCustomerEmail('   ')).toBeUndefined();
    expect(usableCustomerEmail('not-an-email')).toBeUndefined();
    expect(usableCustomerEmail('buyer@example.com')).toBe('buyer@example.com');
  });
});
