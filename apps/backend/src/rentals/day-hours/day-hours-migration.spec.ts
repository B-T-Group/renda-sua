import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('rental day-hours picker migration', () => {
  const root = join(__dirname, '../../../..');
  const dir = join(root, 'hasura/migrations/Rendasua/20261125190000_rental_day_hours_picker');
  const up = readFileSync(join(dir, 'up.sql'), 'utf8');
  const down = readFileSync(join(dir, 'down.sql'), 'utf8');
  const constants = readFileSync(join(root, 'backend/src/app-config/client-flags.constants.ts'), 'utf8');
  const metadata = readFileSync(
    join(root, 'hasura/metadata/databases/Rendasua/tables/public_rental_location_listings.yaml'),
    'utf8'
  );

  it('adds both switches on by default, idempotently, with a one-mode check', () => {
    expect(up).toContain('ADD COLUMN IF NOT EXISTS offers_hourly boolean NOT NULL DEFAULT true');
    expect(up).toContain('ADD COLUMN IF NOT EXISTS offers_daily boolean NOT NULL DEFAULT true');
    expect(up).toContain('CHECK (offers_hourly OR offers_daily)');
    expect(up).toMatch(/IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint/);
  });

  it('seeds the flag false with no environment override', () => {
    expect(up).toContain("'rentals_day_hours_picker_enabled'");
    expect(up).toMatch(/'boolean', false/);
    expect(up).not.toMatch(/'boolean', true/);
    expect(up).toContain('WHERE NOT EXISTS');
    expect(constants).toMatch(/rentals_day_hours_picker_enabled: false/);
    expect(constants).not.toMatch(/rentals_day_hours_picker_enabled:\s*isNonProduction/);
  });

  it('down drops what up added', () => {
    expect(down).toContain('DROP COLUMN IF EXISTS offers_daily');
    expect(down).toContain('DROP COLUMN IF EXISTS offers_hourly');
    expect(down).toContain('rentals_day_hours_picker_enabled');
  });

  it('is newer than every other migration', () => {
    const versions = readdirSync(join(root, 'hasura/migrations/Rendasua'))
      .map((name) => /^(\d+)_/.exec(name)?.[1])
      .filter((v): v is string => Boolean(v))
      .sort();
    expect(versions[versions.length - 1] >= '20261125190000').toBe(true);
  });

  it('lets the business set and every role read the switches', () => {
    expect(metadata.match(/- offers_hourly/g)?.length).toBe(5);
    expect(metadata.match(/- offers_daily/g)?.length).toBe(5);
  });
});
