import { HttpException, HttpStatus } from '@nestjs/common';

export const UPDATE_ADDRESS_MUTATION = `
  mutation UpdateAddress($addressId: uuid!, $set: addresses_set_input!) {
    update_addresses_by_pk(pk_columns: { id: $addressId }, _set: $set) {
      id
      address_line_1
      address_line_2
      city
      state
      postal_code
      country
      is_primary
      address_type
      latitude
      longitude
      instructions
      created_at
      updated_at
      status
    }
  }
`;

export function buildAddressesSetInput(
  updateData: Record<string, unknown>
): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updateData)) {
    if (value !== undefined) set[key] = value;
  }
  return set;
}

export function toAddressUpdateHttpException(
  error: any,
  fallback = 'Failed to update address'
): HttpException {
  if (error instanceof HttpException) return error;
  const message = error?.message || fallback;
  return new HttpException(
    { success: false, error: message, message },
    HttpStatus.INTERNAL_SERVER_ERROR
  );
}
