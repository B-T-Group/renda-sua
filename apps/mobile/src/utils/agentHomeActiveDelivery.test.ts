import {
  filterAgentHomeActionsNeeded,
  shouldHideAgentNowHero,
} from './agentHomeActiveDelivery';

describe('filterAgentHomeActionsNeeded', () => {
  const items = [
    { kind: 'id_verification' },
    { kind: 'active_orders' },
    { kind: 'open_deliveries' },
  ];

  it('removes active_orders when the Home Active Orders section is shown', () => {
    expect(filterAgentHomeActionsNeeded(items, true).map((item) => item.kind)).toEqual(
      ['id_verification', 'open_deliveries']
    );
  });

  it('keeps active_orders when the Active Orders section is hidden', () => {
    expect(filterAgentHomeActionsNeeded(items, false)).toEqual(items);
  });
});

describe('shouldHideAgentNowHero', () => {
  it('hides the hero when Active Orders has at least one item', () => {
    expect(shouldHideAgentNowHero(1)).toBe(true);
    expect(shouldHideAgentNowHero(3)).toBe(true);
  });

  it('keeps the hero when Active Orders is empty', () => {
    expect(shouldHideAgentNowHero(0)).toBe(false);
  });
});
