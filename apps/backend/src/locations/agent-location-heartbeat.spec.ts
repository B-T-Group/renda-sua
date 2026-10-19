import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import type { GoogleDistanceService } from '../google/google-distance.service';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { LocationsService } from './locations.service';

/**
 * #594: mobile sends a stationary heartbeat (same coordinates) through
 * POST /locations/agent/me every 10 minutes, and dispatch reads
 * agent_locations.updated_at as "last seen". An identical-coordinate upsert
 * must therefore still advance updated_at. That holds because
 *  1. the backend always sends the upsert (no "unchanged coords" short-circuit),
 *  2. Hasura turns on_conflict with non-empty update_columns and no `where`
 *     into ON CONFLICT ... DO UPDATE (unconditional), and
 *  3. the BEFORE UPDATE trigger stamps updated_at = NOW() on every row update,
 *     without comparing OLD/NEW.
 */

const MIGRATIONS = join(__dirname, '../../../hasura/migrations/Rendasua');

/**
 * Minimal agent_locations store that applies an insert_agent_locations_one
 * mutation the way Hasura + Postgres do: no conflict -> insert; conflict and
 * empty update_columns -> DO NOTHING (Hasura returns null); conflict with a
 * `where` that the row fails -> no update (null); otherwise DO UPDATE, which
 * fires the updated_at trigger. Reads (executeQuery) see the stored row, so a
 * read-then-skip shortcut in the service would be caught.
 */
function fakeHasura(clock: () => string) {
  const rows = new Map<string, { id: string; agent_id: string; latitude: string; longitude: string; created_at: string; updated_at: string }>();
  const executeMutation = jest.fn(async (mutation: string, vars: Record<string, string>) => {
    const conflict = /on_conflict:\s*\{([\s\S]*?)\}\s*\)/.exec(mutation)?.[1] ?? '';
    const updateColumns = (/update_columns:\s*\[([^\]]*)\]/.exec(conflict)?.[1] ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const hasWhere = /\bwhere\s*:/.test(conflict);
    const existing = rows.get(vars.agent_id);
    if (!existing) {
      const now = clock();
      const row = { id: `loc-${vars.agent_id}`, agent_id: vars.agent_id, latitude: vars.latitude, longitude: vars.longitude, created_at: now, updated_at: now };
      rows.set(vars.agent_id, row);
      return { insert_agent_locations_one: { ...row } };
    }
    if (!conflict || updateColumns.length === 0 || hasWhere) return { insert_agent_locations_one: null };
    for (const c of updateColumns) (existing as Record<string, string>)[c] = vars[c];
    existing.updated_at = clock();
    return { insert_agent_locations_one: { ...existing } };
  });
  const executeQuery = jest.fn(async (_query: string, vars: Record<string, string>) => {
    const row = rows.get(vars.agentId);
    return { agent_locations: row ? [{ ...row }] : [] };
  });
  return { executeMutation, executeQuery, rows };
}

describe('agent location heartbeat (identical coordinates)', () => {
  let now: number;
  let hasura: ReturnType<typeof fakeHasura>;
  let service: LocationsService;

  beforeEach(() => {
    now = Date.parse('2026-10-18T22:00:00Z');
    hasura = fakeHasura(() => new Date(now).toISOString());
    service = new LocationsService(
      hasura as unknown as HasuraSystemService,
      {} as GoogleDistanceService,
      {} as NotificationsService,
      {} as DeliveryConfigService
    );
  });

  it('advances updatedAt when the same coordinates are sent again', async () => {
    const first = await service.upsertMyAgentLocation('agent-1', 4.0511, 9.7679);
    now += 10 * 60_000;
    const second = await service.upsertMyAgentLocation('agent-1', 4.0511, 9.7679);

    expect(hasura.executeMutation).toHaveBeenCalledTimes(2);
    expect(second).toMatchObject({ latitude: 4.0511, longitude: 9.7679, createdAt: first?.createdAt });
    expect(second?.updatedAt).toBe('2026-10-18T22:10:00.000Z');
    expect(Date.parse(String(second?.updatedAt))).toBeGreaterThan(Date.parse(String(first?.updatedAt)));
    expect(hasura.rows.get('agent-1')?.updated_at).toBe('2026-10-18T22:10:00.000Z');
  });

  it('sends an unconditional upsert on the agent_id unique key', async () => {
    await service.upsertMyAgentLocation('agent-1', 1, 2);
    const [mutation] = hasura.executeMutation.mock.calls[0];
    const conflict = /on_conflict:\s*\{([\s\S]*?)\}\s*\)/.exec(mutation)?.[1] ?? '';
    expect(conflict).toMatch(/constraint:\s*agent_locations_agent_id_key/);
    expect(conflict).toMatch(/update_columns:\s*\[\s*longitude,\s*latitude\s*\]/);
    expect(conflict).not.toMatch(/\bwhere\s*:/);
  });
});

describe('agent_locations updated_at trigger (migrations)', () => {
  const ups = readdirSync(MIGRATIONS)
    .filter((d) => /^\d+_/.test(d))
    .sort((a, b) => {
      const x = BigInt(a.split('_')[0]);
      const y = BigInt(b.split('_')[0]);
      return x < y ? -1 : x > y ? 1 : 0;
    })
    .map((d) => {
      try {
        return { dir: d, sql: readFileSync(join(MIGRATIONS, d, 'up.sql'), 'utf8') };
      } catch {
        return { dir: d, sql: '' };
      }
    });

  it('the latest trigger on agent_locations stamps updated_at BEFORE every row UPDATE', () => {
    const events = ups.flatMap(({ dir, sql }) =>
      [...sql.matchAll(/(CREATE|DROP) TRIGGER (?:IF EXISTS )?set_public_agent_locations_updated_at\b([^;]*);/g)].map((m) => ({
        dir,
        kind: m[1],
        text: m[0].replace(/\s+/g, ' '),
      }))
    );
    const last = events[events.length - 1];
    expect(last?.kind).toBe('CREATE');
    expect(last.text).toBe(
      'CREATE TRIGGER set_public_agent_locations_updated_at BEFORE UPDATE ON public.agent_locations FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();'
    );
  });

  it('the latest set_current_timestamp_updated_at sets NOW() without comparing OLD and NEW', () => {
    const defs = ups.flatMap(({ dir, sql }) =>
      [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (?:public\.)?"?set_current_timestamp_updated_at"?\(\)([\s\S]*?)\$\$\s*LANGUAGE/gi)].map(
        (m) => ({ dir, body: m[1] })
      )
    );
    const latest = defs[defs.length - 1];
    expect(latest).toBeDefined();
    expect(latest.body).toMatch(/"?updated_at"?\s*=\s*NOW\(\)/i);
    expect(latest.body).not.toMatch(/\bOLD\b|DISTINCT/i);
    expect(latest.body).not.toMatch(/\bIF\b/i);
  });
});
