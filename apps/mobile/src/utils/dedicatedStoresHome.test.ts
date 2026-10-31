import { groupDedicatedHomeStores } from './dedicatedStoresHome';

const a = (o: Record<string, unknown>) =>
  ({ assignmentId: 'x', locationId: 'l1', storeName: 'B', slotKey: 'morning', startTime: '', endTime: '', status: 'active', source: 'posting', offToday: false, activeOrders: 0, maxActiveOrders: 10, ...o }) as any;

describe('groupDedicatedHomeStores', () => {
  it('groups by store, drops removed rows, sorts by name', () => {
    const rows = groupDedicatedHomeStores([
      a({ slotKey: 'morning' }),
      a({ slotKey: 'evening', status: 'paused' }),
      a({ locationId: 'l2', storeName: 'A', status: 'paused' }),
      a({ locationId: 'l3', storeName: 'C', status: 'removed' }),
    ]);
    expect(rows).toEqual([
      { locationId: 'l2', storeName: 'A', slotKeys: ['morning'], paused: true },
      { locationId: 'l1', storeName: 'B', slotKeys: ['morning', 'evening'], paused: false },
    ]);
  });
  it('is empty without assignments', () => {
    expect(groupDedicatedHomeStores(null)).toEqual([]);
  });
});
