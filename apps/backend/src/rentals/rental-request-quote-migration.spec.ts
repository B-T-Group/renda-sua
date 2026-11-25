import { readFileSync } from 'fs';
import { join } from 'path';

const up = readFileSync(
  join(__dirname, '../../../hasura/migrations/Rendasua/20261125180200_rental_request_quote_backfill/up.sql'),
  'utf8'
);
const down = readFileSync(
  join(__dirname, '../../../hasura/migrations/Rendasua/20261125180200_rental_request_quote_backfill/down.sql'),
  'utf8'
);

describe('rental request quote backfill', () => {
  it('backfills only pending rows whose quote is still null', () => {
    expect(up).not.toContain('rentals_request_card_enabled');
    expect(up).not.toMatch(/NODE_ENV/);
    const source = up.slice(0, up.indexOf('UPDATE public.rental_requests'));
    const update = up.slice(up.indexOf('UPDATE public.rental_requests'));
    for (const part of [source, update]) {
      expect(part).toContain("r.status::text = 'pending'");
      expect(part).toContain('r.quoted_total IS NULL');
    }
    expect(update).toContain('WHEN r.quoted_total IS NULL THEN rolled.total');
    expect(update).toContain('ELSE r.quoted_total');
    expect(up).toContain('BOOL_AND(subtotal IS NOT NULL)');
    expect(up).toContain('WHEN r.rental_pricing_snapshot IS NULL');
    expect(up).not.toMatch(/quoted_total\s*=\s*rolled\.total/);
  });

  it('does not blank quoted totals on the way down', () => {
    expect(down).not.toMatch(/quoted_total\s*=\s*NULL/i);
    expect(down).not.toContain('rentals_request_card_enabled');
  });
});
