import {
  countApplicableDedicatedOpenings,
  groupDedicatedHomeStores,
  resolveBusinessesHubTab,
  sortDedicatedSlotKeys,
} from './dedicatedStoresHome';

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

describe('countApplicableDedicatedOpenings', () => {
  it('counts only openings the agent can still apply to', () => {
    expect(
      countApplicableDedicatedOpenings([
        { disabledReason: null, application: null },
        { disabledReason: 'holds_slot', application: null },
        { disabledReason: 'max_assignments', application: null },
        { disabledReason: null, application: { id: 'app-1' } },
      ])
    ).toBe(1);
    expect(countApplicableDedicatedOpenings(null)).toBe(0);
    expect(countApplicableDedicatedOpenings(undefined)).toBe(0);
  });
});

describe('resolveBusinessesHubTab', () => {
  it('ignores a tab the current focus cannot show', () => {
    expect(resolveBusinessesHubTab('dedicated', true, false)).toBe('dedicated');
    expect(resolveBusinessesHubTab('referred', true, true)).toBe('referred');
    expect(resolveBusinessesHubTab('dedicated', false, true)).toBe('referred');
    expect(resolveBusinessesHubTab('referred', true, false)).toBe('dedicated');
    expect(resolveBusinessesHubTab(undefined, true, true)).toBe('dedicated');
    expect(resolveBusinessesHubTab(undefined, false, false)).toBe('referred');
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
