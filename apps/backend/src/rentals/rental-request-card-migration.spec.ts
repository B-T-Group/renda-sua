import { readFileSync } from 'fs';
import { join } from 'path';

const up = readFileSync(
  join(__dirname, '../../../hasura/migrations/Rendasua/20261112103000_rental_request_card/up.sql'),
  'utf8'
);
const down = readFileSync(
  join(__dirname, '../../../hasura/migrations/Rendasua/20261112103000_rental_request_card/down.sql'),
  'utf8'
);

describe('rental request card migration', () => {
  it('seeds the flag false and only backfills pending rows that can be priced', () => {
    expect(up).toContain("'rentals_request_card_enabled'");
    expect(up).toMatch(/boolean_value,[\s\S]*false/);
    expect(up).not.toMatch(/boolean_value,\s*true/);
    expect(up).toContain("r.status::text = 'pending'");
    expect(up).toContain('r.quoted_total IS NULL');
    expect(up).toContain('BOOL_AND(subtotal IS NOT NULL)');
    expect(up).toContain("!~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'");
    expect(up).toContain('WHEN r.rental_pricing_snapshot IS NULL');
  });

  it('removes only the flag row on the way down', () => {
    expect(down).toContain("config_key = 'rentals_request_card_enabled'");
    expect(down).not.toMatch(/quoted_total\s*=\s*NULL/i);
  });
});
