import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA #559 F4: the dedupe in 20261013120000 must keep the released (money
 * moved) hold, else the oldest, abort on ambiguity, archive what it removes,
 * and stay idempotent. Behaviour was also exercised against Postgres (PGlite)
 * when the PR was written; this guards the SQL from regressing to ctid order.
 */
describe('representative_commission_hold_unique migration (F4)', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../../hasura/migrations/Rendasua/20261013120000_representative_commission_hold_unique/up.sql'
    ),
    'utf8'
  );

  it('never picks the survivor by physical row order', () => {
    expect(sql).not.toMatch(/ctid/);
  });

  it('ranks released / partly released first, then oldest, then id', () => {
    expect(sql).toMatch(
      /ORDER BY \(status = 'released' OR remaining < amount\) DESC,\s*created_at ASC,\s*id ASC/
    );
  });

  it('aborts when more than one hold of a statement already moved money', () => {
    expect(sql).toMatch(/HAVING count\(\*\) > 1[\s\S]*RAISE EXCEPTION/);
  });

  it('archives removed rows and is a no-op without duplicates', () => {
    expect(sql).toContain('representative_commission_holds_dedupe_archive');
    expect(sql).toMatch(/IF dupes > 0 THEN/);
    expect(sql).toMatch(/IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint/);
  });
});
