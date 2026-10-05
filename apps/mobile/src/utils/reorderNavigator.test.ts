import { reorderNavigator } from './reorderNavigator';

type FakeNav = {
  id: string;
  getState: () => { routeNames: string[] };
  getParent: <T>() => T | undefined;
};

function nav(id: string, routeNames: string[], parent?: FakeNav): FakeNav {
  return {
    id,
    getState: () => ({ routeNames }),
    getParent: () => parent,
  };
}

describe('reorderNavigator', () => {
  it('uses the parent stack when the current navigator is the catalog tab', () => {
    const stack = nav('stack', ['ClientMainTabs', 'Cart', 'CartCheckout']);
    const tab = nav('tab', ['ClientBrowse', 'ClientOrders'], stack);

    expect(reorderNavigator(tab)).toBe(stack);
  });

  it('keeps the stack navigator when Cart is already on it', () => {
    const stack = nav('stack', ['ClientMainTabs', 'Cart', 'CartCheckout']);

    expect(reorderNavigator(stack)).toBe(stack);
  });
});
