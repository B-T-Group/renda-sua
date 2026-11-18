import { buildSchema, parse, validate } from 'graphql';
import { CLAIM_NOTICE, RELEASE_NOTICE } from './pickup-decline.queries';

/**
 * Hasura v2 jsonb update inputs. `_delete_elem` is an array index (Int).
 * `_delete_key` removes a string from a jsonb array. `_append` is jsonb only.
 */
const HASURA_BOOKING_SCHEMA = buildSchema(`
  schema { query: query_root mutation: mutation_root }
  type query_root { rental_booking: String }
  scalar uuid
  scalar jsonb
  scalar timestamptz
  input uuid_comparison_exp { _eq: uuid }
  input string_comparison_exp { _eq: String }
  input jsonb_comparison_exp { _contains: jsonb }
  input rental_bookings_bool_exp {
    id: uuid_comparison_exp
    _not: rental_bookings_bool_exp
    refund_notices: jsonb_comparison_exp
    refund_status: string_comparison_exp
    refund_claim_token: uuid_comparison_exp
    refund_provider_ref: string_comparison_exp
  }
  input rental_bookings_append_input { refund_notices: jsonb }
  input rental_bookings_delete_key_input { refund_notices: String }
  input rental_bookings_delete_elem_input { refund_notices: Int }
  type rental_bookings_mutation_response { affected_rows: Int }
  type mutation_root {
    update_rental_bookings(
      where: rental_bookings_bool_exp
      _append: rental_bookings_append_input
      _delete_key: rental_bookings_delete_key_input
      _delete_elem: rental_bookings_delete_elem_input
    ): rental_bookings_mutation_response
  }
`);

function problems(document: string): string[] {
  return validate(HASURA_BOOKING_SCHEMA, parse(document)).map((error) => error.message);
}

describe('decline refund Hasura documents', () => {
  it('accepts the jsonb notice claim and the _delete_key release', () => {
    expect(problems(CLAIM_NOTICE)).toEqual([]);
    expect(problems(RELEASE_NOTICE)).toEqual([]);
    expect(RELEASE_NOTICE).toContain('_delete_key');
  });

  it('rejects _delete_elem with a string, which real Hasura reports as String where Int is expected', () => {
    const invalid = RELEASE_NOTICE.replace('_delete_key', '_delete_elem');
    expect(problems(invalid).join(' ')).toMatch(/String.*Int|Int/i);
  });
});
