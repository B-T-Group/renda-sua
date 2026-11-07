import { groupDedicatedHomeStores, sortDedicatedSlotKeys } from './dedicatedStoresHome';

const a = (o: Record<string, unknown>) =>
  ({ assignmentId: 'x', locationId: 'l1', storeName: 'B', slotKey: 'morning', startTime: '', endTime: '', status: 'active', source: 'posting', offToday: false, activeOrders: 0, maxActiveOrders: 10, ...o }) as any;

describe('groupDedicatedHomeStores', () => {
  it('groups by store, drops removed rows, sorts by name and slot order', () => {
    const rows = groupDedicatedHomeStores([
      a({ slotKey: 'evening' }),
      a({ slotKey: 'afternoon', status: 'paused' }),
      a({ slotKey: 'morning', status: 'paused' }),
      a({ locationId: 'l2', storeName: 'A', status: 'paused' }),
      a({ locationId: 'l3', storeName: 'C', status: 'removed' }),
    ]);
    expect(rows).toEqual([
      { locationId: 'l2', storeName: 'A', slotKeys: ['morning'], paused: true },
      { locationId: 'l1', storeName: 'B', slotKeys: ['morning', 'afternoon', 'evening'], paused: false },
    ]);
  });
  it('is empty without assignments', () => {
    expect(groupDedicatedHomeStores(null)).toEqual([]);
  });
});

describe('sortDedicatedSlotKeys', () => {
  it('orders morning, afternoon, evening', () => {
    expect(sortDedicatedSlotKeys(['evening', 'morning', 'afternoon'])).toEqual([
      'morning',
      'afternoon',
      'evening',
    ]);
  });
});
