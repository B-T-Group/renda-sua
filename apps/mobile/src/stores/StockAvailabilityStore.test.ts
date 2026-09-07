import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchStockAvailabilityCheck, selectPersona } = vi.hoisted(() => ({
  fetchStockAvailabilityCheck: vi.fn(),
  selectPersona: vi.fn(async () => undefined),
}));

vi.mock('../i18n', () => ({
  default: {
    t: (_key: string, opts?: { defaultValue?: string } | string) =>
      typeof opts === 'string' ? opts : opts?.defaultValue ?? _key,
  },
}));

vi.mock('../services/inventoryItemsApi', () => ({
  fetchStockAvailabilityCheck,
  respondStockAvailabilityCheck: vi.fn(),
}));

import { StockAvailabilityStore } from './StockAvailabilityStore';
import type { RootStore } from './RootStore';
import { BUSINESS_PERSONA_HEADERS } from '../notifications/personaHeaders';

function makeRoot(activePersona: 'agent' | 'business' = 'agent'): RootStore {
  return {
    auth: { isAuthenticated: true },
    persona: {
      loadState: 'ready',
      activePersona,
      isDelegationContext: false,
      showMainApp: true,
      personas: ['agent', 'business'],
      pickingPersona: null,
      selectPersona,
    },
  } as unknown as RootStore;
}

describe('StockAvailabilityStore present-first', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchStockAvailabilityCheck.mockResolvedValue({
      data: { currentQuantity: 2, status: 'pending' },
    });
  });

  it('presents immediately off the business persona and header-scopes the fetch', async () => {
    const store = new StockAvailabilityStore(makeRoot('agent'));
    await store.handlePush('msg-1');

    expect(store.visible).toBe(true);
    expect(store.messageId).toBe('msg-1');
    expect(fetchStockAvailabilityCheck).toHaveBeenCalledWith(
      'msg-1',
      BUSINESS_PERSONA_HEADERS
    );
    expect(selectPersona).toHaveBeenCalledWith('business');
  });
});
