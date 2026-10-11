import { readFileSync } from 'fs';
import { join } from 'path';
import { buildDigestMessage, buildSingleMessage, lowStockQty } from './restock-alerts.messages';
import { sellableUnits } from './restock-alerts.repository';
import { isQuietHour, nextQuietEnd, resolveTimeZone } from './restock-time.util';

const links = { url: 'https://rendasua.com/app/items/x?src=restock_alert', appLink: 'a', path: 'p' };

describe('copy (AC doc §6, AC-2.10)', () => {
  it('only names the quantity when 5 or fewer are left', () => {
    expect(lowStockQty(1)).toBe(1);
    expect(lowStockQty(5)).toBe(5);
    expect(lowStockQty(6)).toBeNull();
    const low = buildSingleMessage({ locale: 'en', itemName: 'Kettle', storeName: 'Blue', available: 3, links });
    expect(low.push).toEqual({ title: 'Kettle is back', body: 'Only 3 left at Blue.' });
    const many = buildSingleMessage({ locale: 'en', itemName: 'Kettle', storeName: 'Blue', available: 12, links });
    expect(many.push.body).toBe('Available now at Blue.');
    expect(many.sms).not.toMatch(/left/);
  });

  it('French uses vous-form copy and an accent-free SMS', () => {
    const m = buildSingleMessage({ locale: 'fr', itemName: 'Théière', storeName: 'Boutique Été', available: 2, links });
    expect(m.push.title).toBe('Théière est de retour');
    expect(m.push.body).toBe('Plus que 2 chez Boutique Été.');
    expect(m.sms).toMatch(/Arret : repondez STOP/);
    expect(m.sms).not.toMatch(/[éèêàçû]/);
    expect(m.sms.length).toBeLessThanOrEqual(160);
  });

  it('digest copy', () => {
    expect(buildDigestMessage({ locale: 'en', count: 3, links }).push).toEqual({
      title: '3 items you liked are back',
      body: "Tap to see what's available.",
    });
    expect(buildDigestMessage({ locale: 'fr', count: 2, links }).push.title).toBe(
      '2 articles que vous aimez sont de retour'
    );
  });
});

describe('quiet hours helpers', () => {
  it('computes local hour across timezones, including Toronto DST', () => {
    expect(isQuietHour(new Date('2026-10-12T20:00:00Z'), 'Africa/Douala')).toBe(true); // 21:00
    expect(isQuietHour(new Date('2026-10-12T19:59:00Z'), 'Africa/Douala')).toBe(false);
    expect(isQuietHour(new Date('2026-10-13T07:00:00Z'), 'Africa/Douala')).toBe(false); // 08:00
    expect(isQuietHour(new Date('2026-10-13T06:59:00Z'), 'Africa/Douala')).toBe(true);
    expect(isQuietHour(new Date('2026-10-13T01:30:00Z'), 'America/Toronto')).toBe(true); // 21:30 EDT
    expect(nextQuietEnd(new Date('2026-10-13T01:30:00Z'), 'America/Toronto').toISOString()).toBe(
      '2026-10-13T12:00:00.000Z'
    );
    expect(nextQuietEnd(new Date('2026-10-13T03:00:00Z'), 'Africa/Libreville').toISOString()).toBe(
      '2026-10-13T07:00:00.000Z'
    );
  });

  it('falls back to the market timezone, then Douala', () => {
    expect(resolveTimeZone(null, 'CA')).toBe('America/Toronto');
    expect(resolveTimeZone('Not/AZone', 'GA')).toBe('Africa/Libreville');
    expect(resolveTimeZone(undefined, null)).toBe('Africa/Douala');
    expect(resolveTimeZone('America/Toronto', 'CM')).toBe('America/Toronto');
  });
});

describe('sellableUnits (mirrors restock_available_quantity SQL)', () => {
  it('handles inactive, reserved and variant rows', () => {
    expect(sellableUnits({ quantity: 5, reserved_quantity: 2, is_active: true })).toBe(3);
    expect(sellableUnits({ quantity: 5, reserved_quantity: 5, is_active: true })).toBe(0);
    expect(sellableUnits({ quantity: 5, reserved_quantity: 0, is_active: false })).toBe(0);
    expect(sellableUnits({ quantity: 5, reserved_quantity: 0, is_active: null })).toBe(0);
    const variant = (q: number, active = true) => ({ quantity: q, is_active: active });
    expect(sellableUnits({ quantity: 6, reserved_quantity: 0, is_active: true, item_variant: variant(6) })).toBe(6);
    expect(sellableUnits({ quantity: 6, reserved_quantity: 1, is_active: true, item_variant: variant(6) })).toBe(0);
    expect(sellableUnits({ quantity: 6, reserved_quantity: 0, is_active: true, item_variant: variant(2, false) })).toBe(0);
  });
});

describe('migration safety (static checks, DDL itself is verified on DEV)', () => {
  const dir = join(__dirname, '../../../hasura/migrations/Rendasua/20261011150000_restock_alerts_v1');
  const up = readFileSync(join(dir, 'up.sql'), 'utf8');
  const down = readFileSync(join(dir, 'down.sql'), 'utf8');

  it('inserts the flag false with WHERE NOT EXISTS and never uses now() in an index predicate', () => {
    expect(up).toMatch(/'restock_alerts_v1',[\s\S]*?'boolean', false, NULL[\s\S]*?WHERE NOT EXISTS/);
    const indexes = up.split(';').filter((s) => /CREATE INDEX/i.test(s));
    expect(indexes.length).toBeGreaterThan(5);
    for (const stmt of indexes) expect(stmt).not.toMatch(/now\(\)/i);
    expect(up).toMatch(/restock_alerts_user_item_key UNIQUE \(user_id, item_id\)/);
    expect(up).toMatch(/restock_alert_sends_idempotency_key_key UNIQUE \(idempotency_key\)/);
  });

  it('is idempotent and has a matching down migration', () => {
    expect(up).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(up).not.toMatch(/CREATE INDEX (?!IF NOT EXISTS)/);
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.restock_alerts/);
    expect(down).toMatch(/DROP TRIGGER IF EXISTS business_inventory_emit_restock_event/);
  });

  it('defaults push on and WhatsApp/SMS off', () => {
    expect(up).toMatch(/restock_alerts_push_enabled boolean NOT NULL DEFAULT true/);
    expect(up).toMatch(/restock_alerts_whatsapp_enabled boolean NOT NULL DEFAULT false/);
    expect(up).toMatch(/restock_alerts_sms_enabled boolean NOT NULL DEFAULT false/);
  });

  it('metadata exposes only own rows to user roles', () => {
    const meta = readFileSync(
      join(__dirname, '../../../hasura/metadata/databases/Rendasua/tables/public_restock_alerts.yaml'),
      'utf8'
    );
    expect(meta).toMatch(/_eq: X-Hasura-User-Id/);
    expect(meta).not.toMatch(/role: anonymous/);
    expect(meta.match(/filter:/g)!.length).toBeGreaterThanOrEqual(8);
  });
});
