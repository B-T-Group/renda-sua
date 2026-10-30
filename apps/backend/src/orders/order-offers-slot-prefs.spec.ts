import { OrderOffersService } from './order-offers.service';

/** #594 addendum AC-P7..P12: preferred-slot filter on normal scheduled dispatch. */
describe('OrderOffersService slot preference filter', () => {
  const ranked = [
    { agentId: 'a1', userId: 'u1', distanceKm: 1 },
    { agentId: 'a2', userId: 'u2', distanceKm: 2 },
    { agentId: 'a3', userId: 'u3', distanceKm: 3 },
  ];
  let hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };
  let dedicated: { scheduledSlotKey: jest.Mock; notePrefSlotFallback: jest.Mock; notePrefSlotPoolSize: jest.Mock };
  let service: any;

  const prefs = (rows: Array<{ id: string; pref_evening?: boolean }>, passed: string[] = []) =>
    hasura.executeQuery.mockResolvedValue({ agents: rows, order_offers: passed.map((agent_id) => ({ agent_id })) });

  beforeEach(() => {
    hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    dedicated = {
      scheduledSlotKey: jest.fn().mockResolvedValue('evening'),
      notePrefSlotFallback: jest.fn(),
      notePrefSlotPoolSize: jest.fn(),
    };
    const u = undefined as any;
    service = new OrderOffersService(hasura as any, u, u, u, u, u, u, u, u, dedicated as any);
  });

  const run = () => service.applySlotPreference('order-1', ranked);

  it('AC-P8: offers only agents with the slot ON', async () => {
    prefs([{ id: 'a1', pref_evening: false }, { id: 'a2', pref_evening: true }, { id: 'a3' }]);
    expect((await run()).map((c: any) => c.agentId)).toEqual(['a2', 'a3']);
    expect(dedicated.notePrefSlotFallback).not.toHaveBeenCalled();
  });

  it('AC-P10: empty preferred pool -> unfiltered, logged as empty', async () => {
    prefs(ranked.map((c) => ({ id: c.agentId, pref_evening: false })));
    expect(await run()).toEqual(ranked);
    expect(dedicated.notePrefSlotFallback).toHaveBeenCalledWith('order-1', 'evening', 'empty');
  });

  it('AC-P10: every preferred agent declined/expired -> unfiltered, logged as all_declined', async () => {
    prefs([{ id: 'a1', pref_evening: false }, { id: 'a2' }, { id: 'a3' }], ['a2', 'a3']);
    expect(await run()).toEqual(ranked);
    expect(dedicated.notePrefSlotFallback).toHaveBeenCalledWith('order-1', 'evening', 'all_declined');
  });

  it('AC-P11: ASAP / unresolved slot -> no filter, no prefs query', async () => {
    dedicated.scheduledSlotKey.mockResolvedValue(null);
    expect(await run()).toEqual(ranked);
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('fails open when the prefs query errors', async () => {
    hasura.executeQuery.mockRejectedValue(new Error('boom'));
    expect(await run()).toEqual(ranked);
    expect(dedicated.notePrefSlotPoolSize).not.toHaveBeenCalled();
    expect(dedicated.notePrefSlotFallback).not.toHaveBeenCalled();
  });

  it('drops only the preferred agents who already passed; the rest stay offered', async () => {
    prefs(
      [
        { id: 'a1', pref_evening: false },
        { id: 'a2', pref_evening: true },
        { id: 'a3', pref_evening: true },
      ],
      ['a2']
    );
    expect((await run()).map((c: { agentId: string }) => c.agentId)).toEqual(['a3']);
    expect(dedicated.notePrefSlotFallback).not.toHaveBeenCalled();
    expect(dedicated.notePrefSlotPoolSize).toHaveBeenCalledWith('order-1', 'evening', 'scheduled', 1);
    expect(hasura.executeQuery).toHaveBeenCalledWith(expect.any(String), {
      ids: ['a1', 'a2', 'a3'],
      orderId: 'order-1',
    });
  });

  it('keeps an agent whose prefs row is missing, and does not treat that as an empty pool', async () => {
    hasura.executeQuery.mockResolvedValue({ agents: [], order_offers: [] });
    expect(await run()).toEqual(ranked);
    expect(dedicated.notePrefSlotFallback).not.toHaveBeenCalled();
    expect(dedicated.notePrefSlotPoolSize).toHaveBeenCalledWith('order-1', 'evening', 'scheduled', 3);
  });

  it('an unknown slot key prefers nobody, then falls back to the full pool', async () => {
    dedicated.scheduledSlotKey.mockResolvedValue('night');
    prefs(ranked.map((c) => ({ id: c.agentId, pref_evening: true })));
    expect(await run()).toEqual(ranked);
    expect(dedicated.notePrefSlotFallback).toHaveBeenCalledWith('order-1', 'night', 'empty');
    expect(dedicated.notePrefSlotPoolSize).toHaveBeenCalledWith('order-1', 'night', 'scheduled', 0);
  });

  it('an empty slot key, an empty candidate list, and no dispatcher skip the prefs query', async () => {
    dedicated.scheduledSlotKey.mockResolvedValue('');
    expect(await run()).toEqual(ranked);
    expect(await service.applySlotPreference('order-1', [])).toEqual([]);
    const bare = new OrderOffersService(
      hasura as any, undefined as any, undefined as any, undefined as any, undefined as any,
      undefined as any, undefined as any, undefined as any, undefined as any
    );
    expect(await (bare as any).applySlotPreference('order-1', ranked)).toEqual(ranked);
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });
});
