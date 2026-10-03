import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOffer, getPendingOffer, acceptOffer, declineOffer } = vi.hoisted(
  () => ({
    getOffer: vi.fn(),
    getPendingOffer: vi.fn(),
    acceptOffer: vi.fn(),
    declineOffer: vi.fn(),
  })
);

vi.mock('../services/orderAlertSound', () => ({
  startOrderAlertSound: vi.fn(),
  stopOrderAlertSound: vi.fn(),
}));

vi.mock('../i18n', () => ({
  default: { t: (_key: string, fallback: string) => fallback },
}));

vi.mock('../services/agentApi', () => ({
  agentApi: {
    orders: { getOffer, getPendingOffer, acceptOffer, declineOffer },
  },
}));

vi.mock('../navigation/rootNavigationRef', () => ({
  navigateToAgentOpenOrders: vi.fn(),
  navigateToOrderFromPush: vi.fn(),
}));

import { navigateToOrderFromPush } from '../navigation/rootNavigationRef';
import {
  startOrderAlertSound,
  stopOrderAlertSound,
} from '../services/orderAlertSound';
import type { OrderOfferDetails } from '../types/orderOffer';
import type { RootStore } from './RootStore';
import { OrderOfferStore } from './OrderOfferStore';

const offer: OrderOfferDetails = {
  orderId: 'ord-1',
  orderNumber: '1001',
  expiresAt: '2026-10-03T12:00:00.000Z',
  distanceKm: 2,
  estimatedEarnings: 500,
  currency: 'XAF',
  estimatedDeliveryMinutes: 20,
  pickup: { businessName: 'Shop', city: 'Douala', state: 'LT' },
  dropoff: { city: 'Douala', state: 'LT' },
};

function makeRoot(overrides?: {
  activePersona?: string;
  personas?: string[];
  loadState?: string;
}): RootStore {
  return {
    auth: { isAuthenticated: true },
    persona: {
      loadState: overrides?.loadState ?? 'ready',
      activePersona: overrides?.activePersona ?? 'agent',
      personas: overrides?.personas ?? ['agent', 'business'],
      selectPersona: vi.fn(async () => undefined),
    },
    ordersSignal: { notifyStatusChanged: vi.fn() },
  } as unknown as RootStore;
}

describe('OrderOfferStore chime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOffer.mockResolvedValue({ success: true, active: true, offer });
  });

  it('loops while an offer is on screen', async () => {
    const store = new OrderOfferStore(makeRoot());
    await store.handleOfferPush('ord-1');

    expect(store.visible).toBe(true);
    expect(store.uiState).toBe('active');
    expect(startOrderAlertSound).toHaveBeenCalledWith('orderOffer');
    expect(stopOrderAlertSound).not.toHaveBeenCalled();
  });

  it('stops when the offer cannot be loaded and leaves the screen up', async () => {
    getOffer.mockRejectedValue(new Error('down'));
    const store = new OrderOfferStore(makeRoot());
    await store.handleOfferPush('ord-1');

    expect(store.visible).toBe(true);
    expect(store.uiState).toBe('error');
    expect(stopOrderAlertSound).toHaveBeenCalledWith('orderOffer');
  });

  it('stops when the delivery is no longer available', async () => {
    getOffer.mockResolvedValue({ success: true, active: false, offer: null });
    const store = new OrderOfferStore(makeRoot());
    await store.handleOfferPush('ord-1');

    expect(store.uiState).toBe('unavailable');
    expect(stopOrderAlertSound).toHaveBeenCalledWith('orderOffer');
  });

  it('does not start before the session can present an offer', async () => {
    const store = new OrderOfferStore(makeRoot({ loadState: 'loading' }));
    await store.handleOfferPush('ord-1');

    expect(store.visible).toBe(false);
    expect(startOrderAlertSound).not.toHaveBeenCalled();
    expect(getOffer).not.toHaveBeenCalled();
  });

  it('starts for a pending offer and stays quiet after the agent closed it', async () => {
    getPendingOffer.mockResolvedValue({ success: true, active: true, offer });
    const store = new OrderOfferStore(makeRoot());
    await store.checkPendingOffer();
    expect(startOrderAlertSound).toHaveBeenCalledWith('orderOffer');

    store.dismiss();
    vi.mocked(startOrderAlertSound).mockClear();
    await store.checkPendingOffer();
    expect(store.visible).toBe(false);
    expect(startOrderAlertSound).not.toHaveBeenCalled();
  });

  it('stops on dismiss', async () => {
    const store = new OrderOfferStore(makeRoot());
    await store.handleOfferPush('ord-1');
    store.dismiss();
    expect(store.visible).toBe(false);
    expect(stopOrderAlertSound).toHaveBeenCalledWith('orderOffer');
  });

  it('stops when the wallet is short and keeps the offer visible', async () => {
    acceptOffer.mockRejectedValue(new Error('insufficient balance'));
    const store = new OrderOfferStore(makeRoot());
    await store.handleOfferPush('ord-1');
    await store.accept();

    expect(store.visible).toBe(true);
    expect(store.uiState).toBe('insufficientFunds');
    expect(stopOrderAlertSound).toHaveBeenCalledWith('orderOffer');
    expect(navigateToOrderFromPush).not.toHaveBeenCalled();
  });

  it('stops when switching to the agent persona fails', async () => {
    const root = makeRoot({ activePersona: 'business' });
    vi.mocked(root.persona.selectPersona).mockRejectedValue(new Error('no'));
    const store = new OrderOfferStore(root);
    await store.handleOfferPush('ord-1');
    await store.accept();

    expect(acceptOffer).not.toHaveBeenCalled();
    expect(store.uiState).toBe('error');
    expect(stopOrderAlertSound).toHaveBeenCalledWith('orderOffer');
  });

  it('stops after a successful accept and ignores a later cancellation for that order', async () => {
    acceptOffer.mockResolvedValue({ success: true });
    const store = new OrderOfferStore(makeRoot());
    await store.handleOfferPush('ord-1');
    await store.accept();

    expect(navigateToOrderFromPush).toHaveBeenCalledWith('ord-1', 'agent');
    expect(store.visible).toBe(false);
    vi.mocked(stopOrderAlertSound).mockClear();
    store.cancelIfMatches('ord-1');
    expect(stopOrderAlertSound).not.toHaveBeenCalled();
    expect(store.uiState).not.toBe('unavailable');
  });

  it('stops when another courier takes the open offer', async () => {
    const store = new OrderOfferStore(makeRoot());
    await store.handleOfferPush('ord-1');
    store.cancelIfMatches('ord-1');

    expect(store.uiState).toBe('unavailable');
    expect(store.visible).toBe(true);
    expect(stopOrderAlertSound).toHaveBeenCalledWith('orderOffer');
  });

  it('stops and declines in the background', async () => {
    declineOffer.mockResolvedValue({ success: true });
    const store = new OrderOfferStore(makeRoot());
    await store.handleOfferPush('ord-1');
    await store.decline();

    expect(store.visible).toBe(false);
    expect(declineOffer).toHaveBeenCalledWith('ord-1');
    expect(stopOrderAlertSound).toHaveBeenCalledWith('orderOffer');
  });
});
