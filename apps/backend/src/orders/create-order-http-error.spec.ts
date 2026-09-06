import { HttpException, HttpStatus } from '@nestjs/common';
import { toCreateOrderHttpException } from './create-order-http-error';

describe('toCreateOrderHttpException', () => {
  it('rethrows existing HttpExceptions', () => {
    const original = new HttpException('already mapped', HttpStatus.FORBIDDEN);
    expect(toCreateOrderHttpException(original)).toBe(original);
  });

  it('maps Stripe 400s to HTTP 400 and keeps the Stripe message', () => {
    const exception = toCreateOrderHttpException({
      message: 'Amount must be at least $0.50 cad',
      statusCode: 400,
    });

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.message).toBe('Amount must be at least $0.50 cad');
    expect(exception.getResponse()).toEqual({
      success: false,
      error: 'Amount must be at least $0.50 cad',
      message: 'Amount must be at least $0.50 cad',
    });
  });

  it('maps unknown service errors to 500 with a useful message', () => {
    const exception = toCreateOrderHttpException(
      new Error('Stripe account is not configured')
    );

    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(exception.message).toBe('Stripe account is not configured');
  });
});
