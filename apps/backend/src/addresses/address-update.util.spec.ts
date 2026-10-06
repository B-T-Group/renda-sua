import { HttpException, HttpStatus } from '@nestjs/common';
import {
  UPDATE_ADDRESS_MUTATION,
  buildAddressesSetInput,
  toAddressUpdateHttpException,
} from './address-update.util';

describe('address-update.util', () => {
  it('omits undefined fields so PATCH cannot null required columns', () => {
    const set = buildAddressesSetInput({
      country: 'CA',
      is_primary: true,
      address_line_1: undefined,
      city: undefined,
      state: undefined,
      postal_code: undefined,
    });

    expect(set).toEqual({ country: 'CA', is_primary: true });
    expect(set).not.toHaveProperty('address_line_1');
    expect(set).not.toHaveProperty('city');
    expect(set).not.toHaveProperty('postal_code');
  });

  it('keeps explicit empty strings and nulls', () => {
    expect(
      buildAddressesSetInput({
        address_line_2: '',
        instructions: null,
      })
    ).toEqual({ address_line_2: '', instructions: null });
  });

  it('uses addresses_set_input so omitted keys stay untouched', () => {
    expect(UPDATE_ADDRESS_MUTATION).toContain('$set: addresses_set_input!');
    expect(UPDATE_ADDRESS_MUTATION).toContain('_set: $set');
  });

  it('keeps HttpExceptions and adds message on remapped 500s', () => {
    const forbidden = new HttpException('nope', HttpStatus.FORBIDDEN);
    expect(toAddressUpdateHttpException(forbidden)).toBe(forbidden);

    const remapped = toAddressUpdateHttpException(
      new Error('null value in column "city" violates not-null constraint')
    );
    expect(remapped.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(remapped.getResponse()).toEqual({
      success: false,
      error: 'null value in column "city" violates not-null constraint',
      message: 'null value in column "city" violates not-null constraint',
    });
    expect(remapped.message).toBe(
      'null value in column "city" violates not-null constraint'
    );
  });
});
