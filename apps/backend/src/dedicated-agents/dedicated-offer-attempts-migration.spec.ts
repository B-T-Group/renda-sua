import { readFileSync } from 'fs';
import { join } from 'path';
import { DEDICATED_NUMBER_CONFIG } from './dedicated-agents.constants';

const DIR = join(__dirname, '../../../hasura/migrations/Rendasua/20261027210000_dedicated_offer_attempts');
const up = readFileSync(join(DIR, 'up.sql'), 'utf8');
const down = readFileSync(join(DIR, 'down.sql'), 'utf8');

describe('20261027210000_dedicated_offer_attempts', () => {
  it('adds the attempt counter with a constant default (metadata-only, no table rewrite)', () => {
    expect(up).toMatch(/ADD COLUMN IF NOT EXISTS dedicated_attempt integer NOT NULL DEFAULT 1/);
    expect(down).toMatch(/DROP COLUMN IF EXISTS dedicated_attempt/);
  });

  it('seeds dedicated_offer_max_attempts at the code default, never a blind insert', () => {
    const spec = DEDICATED_NUMBER_CONFIG.dedicated_offer_max_attempts;
    expect(up).toMatch(new RegExp(`'dedicated_offer_max_attempts'[\\s\\S]*?'number', NULL::boolean, ${spec.fallback}::numeric`));
    expect(up).toMatch(/WHERE NOT EXISTS \([\s\S]*?c\.country_code IS NULL/);
    expect(down).toContain("config_key = 'dedicated_offer_max_attempts'");
  });
});
