import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RestockAlertsApiService } from './restock-alerts-api.service';

type Handler = (vars: any) => any;

function make(opts: {
  flags?: Array<{ country: string | null; value: boolean }>;
  handlers?: Record<string, Handler>;
  tokenPayload?: any;
}) {
  const handlers: Record<string, Handler> = {
    RestockUserCountry: () => ({ users_by_pk: { country: 'CM' } }),
    ...opts.handlers,
  };
  const calls: Array<{ op: string; vars: any }> = [];
  const run = async (doc: string, vars: any) => {
    const op = /(?:query|mutation)\s+(\w+)/.exec(doc)![1];
    calls.push({ op, vars });
    const h = handlers[op];
    if (!h) throw new Error(`unexpected operation ${op}`);
    return h(vars);
  };
  const hasura = { executeQuery: run, executeMutation: run } as any;
  const repo = {
    flagRows: async () => opts.flags ?? [{ country: null, value: true }],
  } as any;
  const inventoryItems = {
    getBestListingsForCatalogItemIds: async (ids: string[]) =>
      ids.map((id) => ({ item_id: id, id: `listing-${id}`, name: id })),
  } as any;
  const tokens = { verify: async () => opts.tokenPayload } as any;
  const tracked: any[] = [];
  const analytics = { track: async (e: any) => void tracked.push(e) } as any;
  const svc = new RestockAlertsApiService(hasura, repo, inventoryItems, tokens, analytics);
  return { svc, calls, tracked };
}

describe('RestockAlertsApiService', () => {
  it('404s every endpoint when the flag is off for the user market', async () => {
    const { svc } = make({ flags: [{ country: null, value: true }, { country: 'CM', value: false }] });
    await expect(svc.assertEnabled('u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(await svc.isEnabledForUser('u1')).toBe(false);
  });

  it('refuses to toggle an alert for an item the user has not liked', async () => {
    const { svc } = make({
      handlers: { RestockLikeAndAlert: () => ({ user_item_likes: [], restock_alerts: [] }) },
    });
    await expect(svc.setItemAlert('u1', 'i1', true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('re-arms a disarmed alert but only flips the bell on a "sent" one (cooldown is kept)', async () => {
    const upsert = jest.fn((v: any) => ({
      insert_restock_alerts_one: { id: 'a', state: v.object.state ?? 'sent', alert_enabled: true, expires_at: null },
    }));
    const disarmed = make({
      handlers: {
        RestockLikeAndAlert: () => ({ user_item_likes: [{ id: 'l' }], restock_alerts: [{ state: 'disarmed', alert_enabled: false }] }),
        RestockUpsertAlert: upsert,
      },
    });
    await disarmed.svc.setItemAlert('u1', 'i1', true);
    expect(upsert.mock.calls[0][0].object).toMatchObject({ state: 'armed', alert_enabled: true, disarm_reason: null });
    expect(upsert.mock.calls[0][0].cols).toContain('armed_at');

    const sent = make({
      handlers: {
        RestockLikeAndAlert: () => ({ user_item_likes: [{ id: 'l' }], restock_alerts: [{ state: 'sent', alert_enabled: false }] }),
        RestockUpsertAlert: upsert,
      },
    });
    upsert.mockClear();
    await sent.svc.setItemAlert('u1', 'i1', true);
    expect(upsert.mock.calls[0][0].object.state).toBeUndefined();
    expect(upsert.mock.calls[0][0].cols).toEqual(['alert_enabled', 'updated_at']);
  });

  it('turning the bell off records a no-PII analytics event', async () => {
    const { svc, tracked } = make({
      handlers: {
        RestockLikeAndAlert: () => ({ user_item_likes: [{ id: 'l' }], restock_alerts: [] }),
        RestockUpsertAlert: () => ({ insert_restock_alerts_one: { state: 'armed', alert_enabled: false, expires_at: null } }),
      },
    });
    await svc.setItemAlert('u1', 'i1', false);
    expect(tracked[0]).toMatchObject({ notificationType: 'restock.disarmed', meta: { reason: 'user_off', surface: 'bell' } });
    expect(JSON.stringify(tracked[0].meta)).not.toMatch(/@|\+\d/);
  });

  it('PATCH preferences writes only the supplied channels and returns defaults otherwise', async () => {
    const set = jest.fn(() => ({}));
    const { svc } = make({
      handlers: {
        RestockEnsurePrefs: () => ({}),
        RestockSetPrefs: set,
        RestockPrefs: () => ({ user_notification_preferences_by_pk: null, users_by_pk: { phone_number: '+237600000001' } }),
      },
    });
    const prefs = await svc.patchPreferences('u1', { sms: true });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ set: expect.objectContaining({ restock_alerts_sms_enabled: true }) }));
    expect((set.mock.calls[0] as any)[0].set).not.toHaveProperty('restock_alerts_push_enabled');
    expect(prefs).toMatchObject({ push: true, whatsapp: false, sms: false });
  });

  it('rejects a non-boolean preference before RestockSetPrefs', async () => {
    const set = jest.fn(() => ({}));
    const { svc } = make({
      handlers: {
        RestockEnsurePrefs: () => ({}),
        RestockSetPrefs: set,
      },
    });
    await expect(
      svc.patchPreferences('u1', { push: 'nope' as unknown as boolean })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(set).not.toHaveBeenCalled();
  });

  describe('likes with bell state', () => {
    const now = new Date('2026-10-12T15:00:00Z');
    const stockRow = (item: string, avail: number, restocked: string | null, country = 'Cameroon') => ({
      item_id: item,
      id: `inv-${item}`,
      quantity: avail,
      reserved_quantity: 0,
      is_active: true,
      last_restocked_at: restocked,
      item_variant: null,
      business_location: { is_active: true, address: { country } },
    });
    const handlers = {
      RestockUserLikes: () => ({
        user_item_likes: [
          { item_id: 'soldout', created_at: '2026-10-01T00:00:00Z' },
          { item_id: 'instock', created_at: '2026-10-02T00:00:00Z' },
          { item_id: 'back', created_at: '2026-10-03T00:00:00Z' },
          { item_id: 'old', created_at: '2026-01-01T00:00:00Z' },
          { item_id: 'othermarket', created_at: '2026-10-04T00:00:00Z' },
        ],
        restock_alerts: [{ item_id: 'old', state: 'armed', disarm_reason: null, alert_enabled: true, expires_at: '2026-04-01T00:00:00Z' }],
      }),
      RestockStockForItems: () => ({
        business_inventory: [
          stockRow('soldout', 0, null),
          stockRow('instock', 4, '2026-08-01T00:00:00Z'),
          stockRow('back', 2, '2026-10-12T10:00:00Z'),
          stockRow('old', 0, null),
          stockRow('othermarket', 5, '2026-10-12T10:00:00Z', 'CA'),
        ],
      }),
    };

    it('orders Back in stock first, in stock next, sold out last, and exposes the bell state', async () => {
      const { svc } = make({ handlers });
      const res = await svc.listLikes('u1', 'all', 1, 20, now);
      expect(res.items.map((i: any) => i.item_id)).toEqual(['back', 'instock', 'soldout', 'old', 'othermarket']);
      const by = (id: string) => res.items.find((i: any) => i.item_id === id) as any;
      expect(by('back')).toMatchObject({ back_in_stock: true, in_stock: true });
      expect(by('instock')).toMatchObject({ back_in_stock: false, in_stock: true });
      expect(by('soldout').restock_alert).toMatchObject({ state: 'on', enabled: true });
      expect(by('old').restock_alert.state).toBe('expired');
      expect(by('othermarket')).toMatchObject({ in_stock: false });
    });

    it('filters to Back in stock (restocked within 48h) and paginates', async () => {
      const { svc } = make({ handlers });
      const res = await svc.listLikes('u1', 'back_in_stock', 1, 20, now);
      expect(res.items.map((i: any) => i.item_id)).toEqual(['back']);
      expect(res.total).toBe(1);
      const page = await svc.listLikes('u1', 'all', 2, 2, now);
      expect(page.items).toHaveLength(2);
      expect(page.totalPages).toBe(3);
    });
  });

  describe('stop from message', () => {
    it('turns off only the token channel and logs the opt-out surface', async () => {
      const set = jest.fn(() => ({}));
      const { svc, tracked } = make({
        tokenPayload: { userId: 'u1', action: 'restock_stop:sms', entityId: 'u1' },
        handlers: { RestockEnsurePrefs: () => ({}), RestockSetPrefs: set },
      });
      const out = await svc.stopFromMessage('tok');
      expect(out).toEqual({ channel: 'sms', stopped: true });
      expect((set.mock.calls[0] as any)[0].set).toMatchObject({ restock_alerts_sms_enabled: false });
      expect((set.mock.calls[0] as any)[0].set).not.toHaveProperty('restock_alerts_push_enabled');
      expect(tracked[0].meta).toEqual({ surface: 'message', channel: 'sms' });
    });

    it('rejects tokens minted for another action', async () => {
      const { svc } = make({ tokenPayload: { userId: 'u1', action: 'order_confirm', entityId: 'o1' } });
      await expect(svc.stopFromMessage('tok')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
