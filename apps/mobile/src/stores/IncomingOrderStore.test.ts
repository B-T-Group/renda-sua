import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getById, selectPersona, confirm, markBusy, getPendingAcceptance } =
  vi.hoisted(() => ({
    getById: vi.fn(),
    selectPersona: vi.fn(async () => undefined),
    confirm: vi.fn(),
    markBusy: vi.fn(),
    getPendingAcceptance: vi.fn(),
  }));

vi.mock('../i18n', () => ({
  default: { t: (_key: string, fallback: string) => fallback },
}));

vi.mock('../services/businessApi', () => ({
  businessApi: {
    orders: {
      getById,
      getPendingAcceptance,
      confirm,
      markBusy,
      cancel: vi.fn(),
    },
  },
}));

import { IncomingOrderStore } from './IncomingOrderStore';
import type { RootStore } from './RootStore';
import { BUSINESS_PERSONA_HEADERS } from '../notifications/personaHeaders';
import type { IncomingOrderDetails } from '../types/incomingOrder';
import { BUSY_SNOOZE_MS } from '../constants/incomingOrder';

function makeRoot(overrides?: {
  activePersona?: 'agent' | 'business';
  isDelegationContext?: boolean;
}): RootStore {
  return {
    auth: { isAuthenticated: true },
    persona: {
      loadState: 'ready',
      activePersona: overrides?.activePersona ?? 'agent',
      isDelegationContext: overrides?.isDelegationContext ?? false,
      showMainApp: true,
      personas: ['agent', 'business'],
      pickingPersona: null,
      selectPersona,
    },
  } as unknown as RootStore;
}

describe('IncomingOrderStore present-first', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getById.mockResolvedValue({
      order: {
        id: 'ord-1',
        current_status: 'pending',
        acceptance_state: 'awaiting_acceptance',
        delivery_time_windows: [],
      },
    });
  });

  it('switches persona, then presents, and header-scopes the fetch', async () => {
    const store = new IncomingOrderStore(makeRoot({ activePersona: 'agent' }));
    await store.handleIncomingPush('ord-1');

    expect(store.visible).toBe(true);
    expect(store.orderId).toBe('ord-1');
    expect(getById).toHaveBeenCalledWith('ord-1', BUSINESS_PERSONA_HEADERS);
    expect(selectPersona).toHaveBeenCalledWith('business');
    // The persona switch must complete before the modal is shown so the
    // navigator remount never races the fullScreen Modal presentation.
    expect(selectPersona.mock.invocationCallOrder[0]).toBeLessThan(
      getById.mock.invocationCallOrder[0]
    );
  });

  it('does not show the modal when dismissed during the settle window', async () => {
    const store = new IncomingOrderStore(
      makeRoot({ activePersona: 'business' })
    );
    const pending = store.handleIncomingPush('ord-1');
    store.dismiss();
    await pending;

    expect(store.visible).toBe(false);
    expect(getById).not.toHaveBeenCalled();
  });

  it('queues instead of presenting when the main app is not showing', async () => {
    const root = makeRoot({ activePersona: 'agent' });
    (root.persona as { showMainApp: boolean }).showMainApp = false;
    const store = new IncomingOrderStore(root);

    await store.handleIncomingPush('ord-1');

    expect(store.visible).toBe(false);
    expect(selectPersona).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
  });

  it('does not eagerly switch persona before presenting when session is not ready', async () => {
    const root = makeRoot({ activePersona: 'agent' });
    (root.persona as { loadState: string }).loadState = 'loading';
    const store = new IncomingOrderStore(root);

    await store.handleIncomingPush('ord-1');

    expect(store.visible).toBe(false);
    expect(selectPersona).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
  });

  it('skips the owner overlay in a delegation context', async () => {
    const store = new IncomingOrderStore(
      makeRoot({ isDelegationContext: true })
    );
    await store.handleIncomingPush('ord-1');

    expect(store.visible).toBe(false);
    expect(getById).not.toHaveBeenCalled();
    expect(selectPersona).not.toHaveBeenCalled();
  });

  it('does not re-present when the same order overlay is already open', async () => {
    const store = new IncomingOrderStore(
      makeRoot({ activePersona: 'business' })
    );
    await store.handleIncomingPush('ord-1');
    expect(store.visible).toBe(true);
    expect(getById).toHaveBeenCalledTimes(1);

    await store.handleIncomingPush('ord-1');

    expect(getById).toHaveBeenCalledTimes(1);
    expect(store.uiState).toBe('active');
  });

  it('retries present when the same order overlay is stuck in error', async () => {
    getById.mockRejectedValueOnce(new Error('network'));
    const store = new IncomingOrderStore(
      makeRoot({ activePersona: 'business' })
    );
    await store.handleIncomingPush('ord-1');
    expect(store.uiState).toBe('error');
    expect(getById).toHaveBeenCalledTimes(1);

    getById.mockResolvedValueOnce({
      order: {
        id: 'ord-1',
        current_status: 'pending',
        acceptance_state: 'awaiting_acceptance',
        delivery_time_windows: [],
      },
    });
    await store.handleIncomingPush('ord-1');

    expect(getById).toHaveBeenCalledTimes(2);
    expect(store.uiState).toBe('active');
  });
});

function orderWithWindows(
  windows: IncomingOrderDetails['delivery_time_windows']
): IncomingOrderDetails {
  return {
    id: 'ord-1',
    current_status: 'pending',
    delivery_time_windows: windows,
  } as IncomingOrderDetails;
}

function storeWithWindows(
  windows: IncomingOrderDetails['delivery_time_windows']
): IncomingOrderStore {
  const store = new IncomingOrderStore(makeRoot({ activePersona: 'business' }));
  store.orderId = 'ord-1';
  store.uiState = 'active';
  store.details = orderWithWindows(windows);
  return store;
}

const PAST_WINDOW = {
  id: 'w1',
  preferred_date: '2020-01-01',
  time_slot_start: '08:00',
  time_slot_end: '12:00',
};

describe('IncomingOrderStore slot-past guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue({ success: true });
    markBusy.mockResolvedValue({ success: true });
  });

  it('confirm is a no-op when the delivery slot is past', async () => {
    const store = storeWithWindows([PAST_WINDOW]);
    await store.confirm();
    expect(confirm).not.toHaveBeenCalled();
    expect(store.uiState).toBe('active');
  });

  it('markBusy is a no-op when the delivery slot is past', async () => {
    const store = storeWithWindows([PAST_WINDOW]);
    await store.markBusy();
    expect(markBusy).not.toHaveBeenCalled();
    expect(store.uiState).toBe('active');
  });

  it('clears previous details when presenting a different order', async () => {
    const store = storeWithWindows([PAST_WINDOW]);
    store.details = { ...orderWithWindows([PAST_WINDOW]), id: 'ord-old' };
    store.visible = true;
    getById.mockResolvedValue({
      order: { id: 'ord-2', current_status: 'pending', delivery_time_windows: [] },
    });
    const pending = store.present('ord-2');
    expect(store.details).toBeNull();
    expect(store.uiState).toBe('loading');
    await pending;
  });
});

describe('IncomingOrderStore busy snooze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getById.mockResolvedValue({
      order: {
        id: 'ord-2',
        current_status: 'pending',
        acceptance_state: 'awaiting_acceptance',
        delivery_time_windows: [],
      },
    });
    markBusy.mockResolvedValue({
      success: true,
      snoozeUntil: new Date(Date.now() + BUSY_SNOOZE_MS).toISOString(),
    });
    getPendingAcceptance.mockResolvedValue({
      active: true,
      order: { id: 'ord-1' },
    });
  });

  it('hides the overlay and ignores the same order until snooze ends', async () => {
    const store = storeWithWindows([]);
    store.visible = true;
    await store.markBusy();

    expect(store.visible).toBe(false);
    await store.checkPendingIncoming();
    await store.handleIncomingPush('ord-1');
    expect(getById).not.toHaveBeenCalled();
  });

  it('still presents a different incoming order while one is snoozed', async () => {
    const store = storeWithWindows([]);
    await store.markBusy();
    await store.handleIncomingPush('ord-2');
    expect(getById).toHaveBeenCalledWith('ord-2', BUSINESS_PERSONA_HEADERS);
    expect(store.visible).toBe(true);
  });
});
