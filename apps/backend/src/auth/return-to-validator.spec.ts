import { HttpException, HttpStatus } from '@nestjs/common';
import { validateReturnTo } from './return-to-validator';

function expectRejected(returnTo: string, error: string) {
  try {
    validateReturnTo(returnTo);
    fail(`expected reject for ${returnTo}`);
  } catch (err: any) {
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(err.getResponse()).toEqual({ success: false, error });
  }
}

describe('validateReturnTo', () => {
  it('defaults missing or blank values to /app', () => {
    expect(validateReturnTo()).toBe('/app');
    expect(validateReturnTo('')).toBe('/app');
    expect(validateReturnTo('   ')).toBe('/app');
  });

  it('allows same-origin relative paths with query and fragment', () => {
    expect(validateReturnTo('/app')).toBe('/app');
    expect(validateReturnTo(' /app/orders?id=1#pay ')).toBe(
      '/app/orders?id=1#pay'
    );
  });

  it('rejects absolute, schemed, and protocol-relative URLs', () => {
    expectRejected(
      'https://evil.example/phish',
      'returnTo must be a relative path starting with /'
    );
    expectRejected(
      'javascript:alert(1)',
      'returnTo must be a relative path starting with /'
    );
    expectRejected(
      '//evil.example/phish',
      'returnTo cannot be a protocol-relative URL'
    );
  });

  it('rejects colon, backslash, and other character bypasses', () => {
    expectRejected(
      '/javascript:alert(1)',
      'returnTo contains invalid characters'
    );
    expectRejected('/app\\evil', 'returnTo contains invalid characters');
    expectRejected('/app evil', 'returnTo contains invalid characters');
  });
});
