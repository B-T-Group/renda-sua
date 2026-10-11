import {
  FakeRepo,
  RESTOCK_FLAG_KEY,
  RESTOCK_WA_TEMPLATE_FLAG_KEY,
  T0,
  at,
  hour,
  makeWorld,
  min,
} from './restock-alerts.fakes';
import { RestockAlertsProcessor, resolveFlag, sameMarket } from './restock-alerts.processor';
import { RestockSchemaMissingError } from './restock-alerts.types';

/** Item "i1" at one CM location, out of stock, liked by u1; restock event at T0. */
function oneItemWorld() {
  const w = makeWorld();
  w.repo.addItem('i1', { name: 'Red Kettle', storeName: 'Blue Store' });
  w.repo.addRow('i1', 'inv1', { available: 3, lastRestockedAt: T0 });
  w.repo.addUser('u1');
  w.repo.like('u1', 'i1');
  w.repo.event('e1', 'i1', 'inv1', T0, at(T0, -hour(48)));
  return w;
}
const AFTER_DEBOUNCE = at(T0, min(11));

describe('flag gating (nothing sends when off)', () => {
  it('does not even take the lock when the flag is off', async () => {
    const w = oneItemWorld();
    w.repo.setFlag(RESTOCK_FLAG_KEY, null, false);
    const r = await w.processor.run(AFTER_DEBOUNCE);
    expect(r.ran).toBe(false);
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.sends).toHaveLength(0);
    expect(w.repo.events[0].status).toBe('pending');
    expect(w.repo.lockExpiry.getTime()).toBe(0);
  });

  it('country row beats the global row, then global, then default false', () => {
    expect(resolveFlag([{ country: null, value: true }, { country: 'CM', value: false }], 'CM')).toBe(false);
    expect(resolveFlag([{ country: null, value: false }, { country: 'CM', value: true }], 'Cameroon')).toBe(true);
    expect(resolveFlag([{ country: null, value: true }], 'CA')).toBe(true);
    expect(resolveFlag([], 'CM')).toBe(false);
    expect(resolveFlag([{ country: 'GA', value: true }], 'CM')).toBe(false);
  });

  it('skips fan-out when Hasura has not tracked restock tables', async () => {
    const w = oneItemWorld();
    w.repo.recoverStale = async () => {
      throw new RestockSchemaMissingError();
    };
    const r = await w.processor.run(AFTER_DEBOUNCE);
    expect(r.ran).toBe(true);
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.events[0].status).toBe('pending');
    expect(w.repo.lockExpiry.getTime()).toBe(0);
  });

  it('a market with its own false row gets nothing even when the global row is on', async () => {
    const w = oneItemWorld();
    w.repo.setFlag(RESTOCK_FLAG_KEY, 'CM', false);
    w.repo.setFlag(RESTOCK_FLAG_KEY, 'CA', true); // anyEnabled stays true
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.sends).toHaveLength(0);
  });
});

describe('AC-2.2 debounce 10 minutes + AC-2.8 stock re-check', () => {
  it('waits for the 10 minute window', async () => {
    const w = oneItemWorld();
    await w.processor.run(at(T0, min(9)));
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.events[0].status).toBe('pending');
    await w.processor.run(at(T0, min(10)));
    expect(w.notifier.calls).toHaveLength(1);
  });

  it('cancels silently when stock flips back to 0 inside the window; the pair stays armed', async () => {
    const w = oneItemWorld();
    w.repo.alerts.push({ userId: 'u1', itemId: 'i1', state: 'armed', enabled: true, armedAt: at(T0, -hour(48)), lastAlertAt: null, lastEventId: null });
    w.repo.setAvailable('i1', 'inv1', 0);
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.repo.events[0].status).toBe('cancelled');
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.alerts[0].state).toBe('armed');
    expect(w.analytics.events.map((e) => e.event)).toContain('restock.debounce_cancelled');
  });

  it('drops a queued send when the item sold out again before delivery (re-check at send time)', async () => {
    const w = oneItemWorld();
    // quiet hours at first run so the send stays queued, then stock disappears
    w.repo.users.get('u1')!.timezone = 'Africa/Douala';
    const night = new Date('2026-10-12T20:30:00.000Z'); // 21:30 Douala
    w.repo.events[0].createdAt = at(night, -min(20));
    await w.processor.run(night);
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.sends[0].status).toBe('queued');
    w.repo.setAvailable('i1', 'inv1', 0);
    await w.processor.run(new Date('2026-10-13T07:05:00.000Z')); // 08:05 Douala
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.sends[0]).toMatchObject({ status: 'dropped', reason: 'sold_out' });
  });
});

describe('send happy path, AC-2.1 one alert per transition, AC-2.10 quantity copy', () => {
  it('sends one push, consumes the arming and logs the send', async () => {
    const w = oneItemWorld();
    const r = await w.processor.run(AFTER_DEBOUNCE);
    expect(r.messagesSent).toBe(1);
    expect(w.notifier.calls).toEqual([
      expect.objectContaining({ userId: 'u1', channel: 'push', title: 'Red Kettle is back', kind: 'single', key: 'restock:e1:u1' }),
    ]);
    expect(w.repo.sends[0]).toMatchObject({ status: 'sent', channel: 'push' });
    expect(w.repo.alerts[0]).toMatchObject({ state: 'sent', lastEventId: 'e1' });
    expect(w.repo.events[0].status).toBe('fanned_out');
    expect(w.analytics.events.find((e) => e.event === 'restock.alert_sent')?.meta).toEqual({
      channel: 'push',
      digest: false,
      qty_bucket: '2-5',
    });
  });

  it('never sends twice for the same transition (second pass is a no-op)', async () => {
    const w = oneItemWorld();
    await w.processor.run(AFTER_DEBOUNCE);
    await w.processor.run(at(AFTER_DEBOUNCE, min(1)));
    await w.processor.run(at(AFTER_DEBOUNCE, hour(2)));
    expect(w.notifier.calls).toHaveLength(1);
  });

  it('uses the French copy and tells the quantity only when 5 or fewer are left', async () => {
    const w = oneItemWorld();
    w.repo.users.get('u1')!.language = 'fr';
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls[0].title).toBe('Red Kettle est de retour');
    const w2 = oneItemWorld();
    w2.repo.setAvailable('i1', 'inv1', 6);
    await w2.processor.run(AFTER_DEBOUNCE);
    expect(w2.analytics.events.find((e) => e.event === 'restock.alert_sent')?.meta.qty_bucket).toBe('6+');
  });

  it('skips items that are not visible, and users outside the item market', async () => {
    const w = oneItemWorld();
    w.repo.items.get('i1')!.visible = false;
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.repo.events[0]).toMatchObject({ status: 'cancelled', note: 'item_not_visible' });
    expect(w.notifier.calls).toHaveLength(0);

    const w2 = oneItemWorld();
    w2.repo.addUser('ca', { country: 'CA', timezone: 'America/Toronto' });
    w2.repo.like('ca', 'i1');
    await w2.processor.run(AFTER_DEBOUNCE);
    expect(w2.notifier.calls.map((c) => c.userId)).toEqual(['u1']);
  });

  it('matches markets across ISO code and country name', () => {
    expect(sameMarket('CM', 'Cameroon')).toBe(true);
    expect(sameMarket('Canada', 'CA')).toBe(true);
    expect(sameMarket('CA', 'Cameroon')).toBe(false);
    expect(sameMarket(null, 'Cameroon')).toBe(true);
    expect(sameMarket('CM', null)).toBe(false);
  });

  it('does not alert when the item was already in stock in the user market before the restock', async () => {
    const w = oneItemWorld();
    w.repo.addRow('i1', 'inv-old', { available: 4, lastRestockedAt: null, country: 'Cameroon' });
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.events[0].status).toBe('fanned_out');
  });

  it('counts two rows restocked in the same window as one transition (alerts once)', async () => {
    const w = oneItemWorld();
    w.repo.addRow('i1', 'inv2', { available: 2, lastRestockedAt: at(T0, -min(3)) });
    w.repo.event('e2', 'i1', 'inv2', at(T0, -min(3)));
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.repo.events.find((e) => e.id === 'e2')!.status).toBe('superseded');
    expect(w.notifier.calls).toHaveLength(1);
  });
});

describe('AC-2.3 24h cooldown and AC-2.4 6h per-item fan-out cap', () => {
  it('ignores a second restock inside 6 hours of a fan-out', async () => {
    const w = oneItemWorld();
    await w.processor.run(AFTER_DEBOUNCE);
    w.repo.event('e2', 'i1', 'inv1', at(T0, hour(2)));
    await w.processor.run(at(T0, hour(2) + min(11)));
    expect(w.repo.events.find((e) => e.id === 'e2')).toMatchObject({ status: 'suppressed', note: 'fanout_cap_6h' });
    expect(w.notifier.calls).toHaveLength(1);
  });

  it('stays disarmed inside 24h of the last alert, re-arms after 24h', async () => {
    const w = oneItemWorld();
    await w.processor.run(AFTER_DEBOUNCE);
    // sells out and restocks again 3 h later
    w.repo.fanouts = []; // isolate the per-user cooldown from the 6h per-item cap
    w.repo.event('e2', 'i1', 'inv1', at(T0, hour(3)), at(T0, hour(2)));
    w.repo.rows.get('i1')![0].lastRestockedAt = at(T0, hour(3));
    await w.processor.run(at(T0, hour(3) + min(11)));
    expect(w.notifier.calls).toHaveLength(1);
    expect(w.analytics.events.some((e) => e.meta.reason === 'cooldown')).toBe(true);
    // 25 h after the first alert (17:00 local, outside quiet hours)
    w.repo.event('e3', 'i1', 'inv1', at(T0, hour(25)), at(T0, hour(24)));
    w.repo.rows.get('i1')![0].lastRestockedAt = at(T0, hour(25));
    await w.processor.run(at(T0, hour(25) + min(11)));
    expect(w.notifier.calls).toHaveLength(2);
    expect(w.notifier.calls[1].key).toBe('restock:e3:u1');
  });

  it('a re-like (state armed again) inside 24h of the last alert does not bypass the cooldown', async () => {
    const w = oneItemWorld();
    w.repo.alerts.push({ userId: 'u1', itemId: 'i1', state: 'armed', enabled: true, armedAt: at(T0, -min(5)), lastAlertAt: at(T0, -hour(2)), lastEventId: 'old' });
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls).toHaveLength(0);
  });

  it('does not alert a user who bought (disarmed), unliked, or turned the bell off', async () => {
    for (const mutate of [
      (r: FakeRepo) => r.alerts.push({ userId: 'u1', itemId: 'i1', state: 'disarmed', enabled: true, armedAt: T0, lastAlertAt: null, lastEventId: null }),
      (r: FakeRepo) => r.alerts.push({ userId: 'u1', itemId: 'i1', state: 'armed', enabled: false, armedAt: T0, lastAlertAt: null, lastEventId: null }),
      (r: FakeRepo) => (r.likes = []),
    ]) {
      const w = oneItemWorld();
      mutate(w.repo);
      await w.processor.run(AFTER_DEBOUNCE);
      expect(w.notifier.calls).toHaveLength(0);
    }
  });

  it('drops a queued send when the user unliked between fan-out and delivery', async () => {
    const w = oneItemWorld();
    const night = new Date('2026-10-12T20:30:00.000Z');
    w.repo.events[0].createdAt = at(night, -min(20));
    await w.processor.run(night); // queued, quiet hours
    w.repo.likes = [];
    await w.processor.run(new Date('2026-10-13T07:05:00.000Z'));
    expect(w.repo.sends[0]).toMatchObject({ status: 'dropped', reason: 'unliked' });
    expect(w.notifier.calls).toHaveLength(0);
  });

  it('skips an item the user has in an active order', async () => {
    const w = oneItemWorld();
    w.repo.activeOrders.add('u1:i1');
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.sends[0]).toMatchObject({ status: 'suppressed', reason: 'in_order' });
  });
});

describe('90 day expiry', () => {
  it('expires silently when armed more than 90 days with no restock', async () => {
    const w = oneItemWorld();
    w.repo.likes[0].createdAt = at(T0, -hour(24 * 100));
    w.repo.events[0].outOfStockSince = at(T0, -hour(24 * 95));
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.alerts[0].state).toBe('disarmed');
  });

  it('counts from the sell-out when the like was made while in stock', async () => {
    const w = oneItemWorld();
    w.repo.likes[0].createdAt = at(T0, -hour(24 * 200));
    w.repo.events[0].outOfStockSince = at(T0, -hour(24 * 10));
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls).toHaveLength(1);
  });
});

describe('AC-2.7 quiet hours', () => {
  it('queues to 08:00 local (user timezone) and sends then', async () => {
    const w = oneItemWorld();
    const night = new Date('2026-10-12T20:30:00.000Z'); // 21:30 Africa/Douala
    w.repo.events[0].createdAt = at(night, -min(20));
    await w.processor.run(night);
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.sends[0].notBefore.toISOString()).toBe('2026-10-13T07:00:00.000Z');
    await w.processor.run(new Date('2026-10-13T06:59:00.000Z'));
    expect(w.notifier.calls).toHaveLength(0);
    await w.processor.run(new Date('2026-10-13T07:00:00.000Z'));
    expect(w.notifier.calls).toHaveLength(1);
  });

  it('falls back to the market timezone when the user has none', async () => {
    const w = oneItemWorld();
    w.repo.users.get('u1')!.timezone = null; // CM -> Africa/Douala
    const night = new Date('2026-10-12T20:30:00.000Z');
    w.repo.events[0].createdAt = at(night, -min(20));
    await w.processor.run(night);
    expect(w.repo.sends[0].notBefore.toISOString()).toBe('2026-10-13T07:00:00.000Z');
  });

  it('is not quiet at 20:59 local and quiet from 21:00', async () => {
    const w = oneItemWorld();
    w.repo.events[0].createdAt = new Date('2026-10-12T19:30:00.000Z');
    await w.processor.run(new Date('2026-10-12T19:59:00.000Z')); // 20:59 Douala
    expect(w.notifier.calls).toHaveLength(1);
    const w2 = oneItemWorld();
    w2.repo.events[0].createdAt = new Date('2026-10-12T19:30:00.000Z');
    await w2.processor.run(new Date('2026-10-12T20:00:00.000Z')); // 21:00 Douala
    expect(w2.notifier.calls).toHaveLength(0);
  });
});

describe('AC-2.5 3/day cap and AC-2.6 digest', () => {
  function multiItemWorld(count: number, spacingMs = min(1)) {
    const w = makeWorld();
    w.repo.addUser('u1');
    for (let i = 1; i <= count; i++) {
      w.repo.addItem(`i${i}`, { name: `Thing ${i}` });
      w.repo.addRow(`i${i}`, `inv${i}`, { available: 9, lastRestockedAt: at(T0, i * spacingMs) });
      w.repo.like('u1', `i${i}`);
      w.repo.event(`e${i}`, `i${i}`, `inv${i}`, at(T0, i * spacingMs), at(T0, -hour(30)));
    }
    return w;
  }

  it('combines two restocks within 60 minutes into ONE digest message', async () => {
    const w = multiItemWorld(2);
    await w.processor.run(at(T0, min(30)));
    expect(w.notifier.calls).toHaveLength(1);
    expect(w.notifier.calls[0]).toMatchObject({ kind: 'digest', title: '2 items you liked are back' });
    const sent = w.repo.sentTo('u1');
    expect(sent).toHaveLength(2);
    expect(new Set(sent.map((s) => s.digestKey)).size).toBe(1);
    expect(sent.every((s) => s.isDigest)).toBe(true);
  });

  it('sends restocks more than 60 minutes apart as separate single alerts', async () => {
    const w = multiItemWorld(2, min(90));
    await w.processor.run(at(T0, hour(4)));
    expect(w.notifier.calls.map((c) => c.kind)).toEqual(['single', 'single']);
  });

  it('holds the daily cap at 3 messages; a 4th lone item is suppressed, a group goes out as one digest', async () => {
    const w = multiItemWorld(4, min(65)); // four restocks 65 min apart, run at 20:40 local
    await w.processor.run(at(T0, min(280)));
    expect(w.notifier.calls).toHaveLength(3);
    expect(w.repo.sends.filter((s) => s.reason === 'daily_cap')).toHaveLength(1);
    // two more restock at once for a user already at the cap: digest allowed once per 24h
    const w2 = multiItemWorld(5, min(1));
    for (let i = 1; i <= 3; i++) {
      w2.repo.sends.push({ id: `old${i}`, userId: 'u1', itemId: `x${i}`, eventId: 'old', idempotencyKey: `old${i}`, status: 'sent', isDigest: false, digestKey: null, attempts: 1, notBefore: T0, sentAt: at(T0, -hour(i)), updatedAt: T0, channel: 'push' });
    }
    await w2.processor.run(at(T0, min(30)));
    expect(w2.notifier.calls).toHaveLength(1);
    expect(w2.notifier.calls[0].kind).toBe('digest');
    expect(w2.notifier.calls[0].title).toBe('5 items you liked are back');
  });
});

describe('AC-2.9 single channel', () => {
  it('uses only push by default (WhatsApp and SMS are off)', async () => {
    const w = oneItemWorld();
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls.map((c) => c.channel)).toEqual(['push']);
  });

  it('with everything on and the template approved, push still wins and nothing else is sent', async () => {
    const w = oneItemWorld();
    Object.assign(w.repo.users.get('u1')!.prefs, { restockWhatsapp: true, restockSms: true, whatsappEnabled: true });
    w.repo.setFlag(RESTOCK_WA_TEMPLATE_FLAG_KEY, null, true);
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls.map((c) => c.channel)).toEqual(['push']);
  });

  it('falls back push -> WhatsApp -> SMS only when the previous channel did not send', async () => {
    const w = oneItemWorld();
    Object.assign(w.repo.users.get('u1')!.prefs, { restockWhatsapp: true, restockSms: true, whatsappEnabled: true });
    w.repo.setFlag(RESTOCK_WA_TEMPLATE_FLAG_KEY, null, true);
    w.notifier.outcomes = { push: 'skipped', whatsapp: 'skipped' };
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls.map((c) => c.channel)).toEqual(['push', 'whatsapp', 'sms']);
    expect(w.repo.sends[0]).toMatchObject({ status: 'sent', channel: 'sms' });
  });

  it('never uses WhatsApp before the template is approved (own flag, default off)', async () => {
    const w = oneItemWorld();
    Object.assign(w.repo.users.get('u1')!.prefs, { restockPush: false, restockWhatsapp: true, whatsappEnabled: true });
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls).toHaveLength(0);
    expect(w.repo.sends[0]).toMatchObject({ status: 'suppressed', reason: 'no_channel' });
  });

  it('SMS copy: one segment, FR without accents', async () => {
    const w = oneItemWorld();
    Object.assign(w.repo.users.get('u1')!.prefs, { restockPush: false, restockSms: true });
    w.repo.users.get('u1')!.language = 'fr';
    w.repo.items.get('i1')!.name = 'Théière électrique très très très longue '.repeat(5);
    await w.processor.run(AFTER_DEBOUNCE);
    const sms = w.notifier.calls[0].sms;
    expect(sms.length).toBeLessThanOrEqual(160);
    expect(sms).toMatch(/est de retour chez/);
    expect(sms).not.toMatch(/[éèêàç]/);
  });
});

describe('concurrency and idempotency', () => {
  it('two processor instances: the DB lock lets only one run', async () => {
    const w = oneItemWorld();
    const other = new RestockAlertsProcessor(w.repo, w.notifier, w.analytics, { item: () => ({ url: '', appLink: '', path: '' }), likesBackInStock: () => ({ url: '', appLink: '', path: '' }) });
    const [a, b] = await Promise.all([w.processor.run(AFTER_DEBOUNCE), other.run(AFTER_DEBOUNCE)]);
    expect([a.ran, b.ran].filter(Boolean)).toHaveLength(1);
    expect(w.notifier.calls).toHaveLength(1);
  });

  it('even if the lock were broken, the atomic claim sends once', async () => {
    const w = oneItemWorld();
    w.repo.lockGrantAlways = true;
    const other = new RestockAlertsProcessor(w.repo, w.notifier, w.analytics, { item: () => ({ url: '', appLink: '', path: '' }), likesBackInStock: () => ({ url: '', appLink: '', path: '' }) });
    await Promise.all([w.processor.run(AFTER_DEBOUNCE), other.run(AFTER_DEBOUNCE)]);
    expect(w.notifier.calls).toHaveLength(1);
    expect(w.repo.sends).toHaveLength(1);
  });

  it('a duplicate event row for the same restock does not double send', async () => {
    const w = oneItemWorld();
    w.repo.event('e1b', 'i1', 'inv1', at(T0, min(1)));
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls).toHaveLength(1);
    expect(w.repo.sends.map((s) => s.idempotencyKey)).toEqual(['restock:e1b:u1']);
  });

  it('re-running fan-out for the same event reuses the idempotency key (crash recovery)', async () => {
    const w = oneItemWorld();
    await w.repo.insertSends([{ userId: 'u1', itemId: 'i1', eventId: 'e1', idempotencyKey: 'restock:e1:u1', notBefore: T0 }]);
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.repo.sends).toHaveLength(1);
    expect(w.notifier.calls).toHaveLength(1);
  });

  it('recovers sends stuck in "sending" as failed (at-most-once, never re-sent)', async () => {
    const w = oneItemWorld();
    w.repo.sends.push({ id: 'stuck', userId: 'u1', itemId: 'i1', eventId: 'e1', idempotencyKey: 'restock:e1:u1', status: 'sending', isDigest: false, digestKey: null, attempts: 1, notBefore: T0, updatedAt: at(T0, -hour(1)) });
    w.repo.events[0].status = 'fanned_out';
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.repo.sends[0]).toMatchObject({ status: 'failed', reason: 'stale_sending' });
    expect(w.notifier.calls).toHaveLength(0);
  });
});

describe('failing notifier never blocks the job', () => {
  it('one user failing does not stop the others, and only the failed send is retried', async () => {
    const w = oneItemWorld();
    w.repo.addUser('u2');
    w.repo.like('u2', 'i1');
    w.notifier.throwFor.add('u1');
    await expect(w.processor.run(AFTER_DEBOUNCE)).resolves.toMatchObject({ ran: true });
    expect(w.repo.sentTo('u2')).toHaveLength(1);
    const failed = w.repo.sends.find((s) => s.userId === 'u1')!;
    expect(failed.status).toBe('queued');
    expect(failed.notBefore.getTime()).toBe(AFTER_DEBOUNCE.getTime() + min(5));
    // u2 is not messaged again on the retry pass
    w.notifier.throwFor.clear();
    await w.processor.run(at(AFTER_DEBOUNCE, min(6)));
    expect(w.notifier.calls.filter((c) => c.userId === 'u2')).toHaveLength(1);
    expect(w.repo.sentTo('u1')).toHaveLength(1);
  });

  it('gives up after 3 attempts', async () => {
    const w = oneItemWorld();
    w.notifier.throwFor.add('u1');
    let now = AFTER_DEBOUNCE;
    for (let i = 0; i < 4; i++) {
      await w.processor.run(now);
      now = at(now, min(20));
    }
    expect(w.notifier.calls).toHaveLength(3);
    expect(w.repo.sends[0].status).toBe('failed');
  });

  it('a failed send does not fall through to a second channel (no double delivery risk)', async () => {
    const w = oneItemWorld();
    Object.assign(w.repo.users.get('u1')!.prefs, { restockSms: true });
    w.notifier.outcomes = { push: 'failed' };
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls.map((c) => c.channel)).toEqual(['push']);
  });

  it('survives a throwing Hasura read for one event and keeps going', async () => {
    const w = oneItemWorld();
    w.repo.addItem('i2');
    w.repo.addRow('i2', 'inv9', { available: 2 });
    w.repo.addUser('u3');
    w.repo.like('u3', 'i2');
    w.repo.event('e9', 'i2', 'inv9', at(T0, -min(1)));
    const orig = w.repo.itemStock.bind(w.repo);
    w.repo.itemStock = async (id: string) => {
      if (id === 'i1') throw new Error('hasura timeout');
      return orig(id);
    };
    await w.processor.run(AFTER_DEBOUNCE);
    expect(w.notifier.calls.map((c) => c.userId)).toEqual(['u3']);
    expect(w.repo.events.find((e) => e.id === 'e1')!.status).toBe('pending'); // retried next minute
  });
});
