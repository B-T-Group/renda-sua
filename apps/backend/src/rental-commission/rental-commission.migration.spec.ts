import { readFileSync } from 'fs';
import { join } from 'path';

const up = readFileSync(
  join(__dirname, '../../../hasura/migrations/Rendasua/20261127140000_rental_commission/up.sql'),
  'utf8'
);

describe('rental commission migration', () => {
  it('seeds the commission flag off and a 15% default rule', () => {
    expect(up).toMatch(/\('rentals_commission_enabled'[\s\S]*?'boolean', false,/);
    expect(up).toMatch(/INSERT INTO public\.rental_commission_rules \(scope, rate_bps, reason\)\s+SELECT 'default', 1500/);
  });

  it('never exposes the commission columns to the renter through Hasura permissions', () => {
    const metadata = readFileSync(
      join(__dirname, '../../../hasura/metadata/databases/Rendasua/tables/public_rental_bookings.yaml'),
      'utf8'
    );
    expect(metadata).not.toMatch(/commission_/);
  });
});
