import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../../hasura');
const DIR = join(ROOT, 'migrations/Rendasua/20261018220000_dedicated_postings');
const up = readFileSync(join(DIR, 'up.sql'), 'utf8');
const down = readFileSync(join(DIR, 'down.sql'), 'utf8');
const functions = readFileSync(join(ROOT, 'metadata/databases/Rendasua/functions/functions.yaml'), 'utf8');
const fnYaml = readFileSync(join(ROOT, 'metadata/databases/Rendasua/functions/public_dedicated_accept_application.yaml'), 'utf8');
const strip = (sql: string) => sql.replace(/--.*$/gm, '');

/** Text checks of the PR 7 migration; behaviour is tested against Postgres in dedicated-accept-application.pg.spec.ts. */
describe('20261018220000_dedicated_postings', () => {
  it('sets a lock timeout before anything else', () => {
    expect(strip(up).trim().startsWith("SET LOCAL lock_timeout = '5s';")).toBe(true);
  });

  it('adds the posting entity type and the five notice types, idempotently', () => {
    expect(up).toMatch(/\('dedicated_agent_posting',/);
    for (const t of ['NEW_APPLICATION', 'ACCEPTED', 'FILLED', 'CLOSED', 'TERMS_UPDATED']) {
      expect(up).toContain(`('DEDICATED_POSTING_${t}'`);
      expect(down).toContain(`'DEDICATED_POSTING_${t}'`);
    }
    expect(up.match(/ON CONFLICT \(id\) DO NOTHING/g)).toHaveLength(2);
  });

  it('the accept function is VOLATILE, returns applications and locks the posting before the application', () => {
    const body = strip(up);
    expect(body).toMatch(/RETURNS SETOF public\.dedicated_agent_applications\s+LANGUAGE plpgsql\s+VOLATILE/);
    const postingLock = body.indexOf('FROM public.dedicated_agent_postings WHERE id = v_posting_id FOR UPDATE');
    const appLock = body.indexOf('FROM public.dedicated_agent_applications WHERE id = p_application_id FOR UPDATE');
    expect(postingLock).toBeGreaterThan(0);
    expect(appLock).toBeGreaterThan(postingLock);
  });

  it('down drops the function and only unused reference rows', () => {
    expect(down).toContain('DROP FUNCTION IF EXISTS public.dedicated_accept_application(uuid, uuid);');
    expect(down).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_messages u WHERE u\.message_type = m\.id\)/);
    expect(down).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_messages u WHERE u\.entity_type = e\.id\)/);
  });

  it('the function is tracked in Hasura metadata', () => {
    expect(functions).toContain('"!include public_dedicated_accept_application.yaml"');
    expect(fnYaml).toMatch(/name: dedicated_accept_application\n\s+schema: public/);
  });
});
