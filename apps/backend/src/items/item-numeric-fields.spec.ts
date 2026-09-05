import { HttpException } from '@nestjs/common';
import {
  assertItemDecimalField,
  rethrowNumericOverflow,
} from './item-numeric-fields';

describe('item-numeric-fields', () => {
  it('allows DECIMAL(10,2) values including the max', () => {
    expect(() => assertItemDecimalField('price', 99_999_999.99)).not.toThrow();
    expect(() => assertItemDecimalField('weight', 0)).not.toThrow();
    expect(() => assertItemDecimalField('shipping_price', null)).not.toThrow();
  });

  it('rejects values that overflow DECIMAL(10,2)', () => {
    expect(() => assertItemDecimalField('price', 100_000_000)).toThrow(
      HttpException
    );
    expect(() => assertItemDecimalField('weight', '1e20')).toThrow(
      HttpException
    );
    expect(() => assertItemDecimalField('shipping_price', Infinity)).toThrow(
      HttpException
    );
  });

  it('ignores non-decimal item fields', () => {
    expect(() => assertItemDecimalField('name', 'x'.repeat(200))).not.toThrow();
    expect(() => assertItemDecimalField('min_order_quantity', 1e12)).not.toThrow();
  });

  it('maps Hasura numeric overflow to HTTP 400', () => {
    expect(() =>
      rethrowNumericOverflow(new Error('numeric field overflow: {"response":{}}'))
    ).toThrow(
      expect.objectContaining({
        status: 400,
        response: expect.objectContaining({ code: 'NUMERIC_FIELD_OVERFLOW' }),
      })
    );
  });

  it('leaves unrelated errors unchanged', () => {
    const error = new Error('field not found');
    expect(() => rethrowNumericOverflow(error)).not.toThrow();
  });
});
