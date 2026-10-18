import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * `set_public_agent_locations_updated_at` is created by both 1764196194000 and
 * 1764197000000 (the trigger was added to the first file after it had been
 * applied). A fresh database replays both, so every CREATE after the first
 * must be preceded by a DROP TRIGGER IF EXISTS, or the replay fails with
 * "trigger already exists". (A fresh PGlite replay was run for this change.)
 */
const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');
const TRIGGER = 'set_public_agent_locations_updated_at';
const code = (sql: string) => sql.replace(/--[^\n]*/g, '');

const ups = readdirSync(MIGRATIONS)
  .filter((d) => /^\d+_/.test(d))
  .sort((a, b) => {
    const x = BigInt(a.split('_')[0]);
    const y = BigInt(b.split('_')[0]);
    return x < y ? -1 : x > y ? 1 : 0;
  })
  .flatMap((dir) => {
    try {
      return [{ dir, sql: code(readFileSync(join(MIGRATIONS, dir, 'up.sql'), 'utf8')) }];
    } catch {
      return [];
    }
  });

describe('agent_locations updated_at trigger migrations replay on a fresh database', () => {
  it('1764197000000 drops the trigger if it exists before creating it', () => {
    const sql = ups.find((u) => u.dir.startsWith('1764197000000_'))?.sql ?? '';
    const drop = sql.indexOf(`DROP TRIGGER IF EXISTS ${TRIGGER} ON public.agent_locations;`);
    const create = sql.indexOf(`CREATE TRIGGER ${TRIGGER}`);
    expect(drop).toBeGreaterThanOrEqual(0);
    expect(create).toBeGreaterThan(drop);
  });

  it('replaying all migrations in order never creates the trigger while it exists', () => {
    let exists = false;
    const events = ups.flatMap(({ dir, sql }) =>
      [...sql.matchAll(new RegExp(`(CREATE TRIGGER|DROP TRIGGER IF EXISTS|DROP TRIGGER) ${TRIGGER}\\b`, 'g'))].map((m) => ({
        dir,
        op: m[1],
      }))
    );
    expect(events.filter((e) => e.op === 'CREATE TRIGGER').length).toBeGreaterThanOrEqual(2);
    for (const e of events) {
      if (e.op === 'CREATE TRIGGER') {
        expect({ dir: e.dir, alreadyExists: exists }).toEqual({ dir: e.dir, alreadyExists: false });
        exists = true;
      } else {
        exists = false;
      }
    }
    expect(exists).toBe(true);
  });
});
