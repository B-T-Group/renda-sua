import { describe, expect, it, vi } from 'vitest';
import {
  leaveClientOrderDetail,
  resolveClientOrderDetailBackTo,
} from './clientOrderDetailBack';

describe('resolveClientOrderDetailBackTo', () => {
  it('honors explicit backTo', () => {
    const navigation = { getState: () => ({ index: 0, routes: [] }) } as any;
    expect(resolveClientOrderDetailBackTo(navigation, 'orders')).toBe('orders');
    expect(resolveClientOrderDetailBackTo(navigation, 'home')).toBe('home');
  });

  it('uses ClientOrders tab from previous route', () => {
    const navigation = {
      getState: () => ({
        index: 1,
        routes: [
          {
            name: 'ClientMainTabs',
            state: {
              index: 0,
              routes: [{ name: 'ClientOrders' }],
            },
          },
          { name: 'OrderDetail' },
        ],
      }),
    } as any;
    expect(resolveClientOrderDetailBackTo(navigation)).toBe('orders');
  });

  it('defaults to home when previous tab is browse', () => {
    const navigation = {
      getState: () => ({
        index: 1,
        routes: [
          {
            name: 'ClientMainTabs',
            state: {
              index: 0,
              routes: [{ name: 'ClientBrowse' }],
            },
          },
          { name: 'OrderDetail' },
        ],
      }),
    } as any;
    expect(resolveClientOrderDetailBackTo(navigation)).toBe('home');
  });
});

describe('leaveClientOrderDetail', () => {
  it('navigates to ClientOrders or ClientBrowse', () => {
    const navigate = vi.fn();
    const navigation = {
      navigate,
      getState: () => ({ index: 0, routes: [] }),
    } as any;

    leaveClientOrderDetail(navigation, 'orders');
    expect(navigate).toHaveBeenCalledWith('ClientMainTabs', {
      screen: 'ClientOrders',
    });

    leaveClientOrderDetail(navigation, 'home');
    expect(navigate).toHaveBeenCalledWith('ClientMainTabs', {
      screen: 'ClientBrowse',
    });
  });
});
