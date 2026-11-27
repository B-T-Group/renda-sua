import { describe, expect, it } from 'vitest';
import type { DiscoveryRecovery } from '@/types/inventoryCatalog';
import { hasRecoveryContent } from './discoveryRecovery';

const empty: DiscoveryRecovery = {
  enabled: true,
  query: '',
  corrected_query: null,
  corrected_total: 0,
  relax: [],
  similar: [],
  categories: [],
  popular_near_you: [],
  ask_renda: { enabled: false, query: '' },
  first_rung: null,
};

describe('hasRecoveryContent', () => {
  it('is false when every rung is empty', () => {
    expect(hasRecoveryContent(empty, true)).toBe(false);
  });

  it('is true when categories exist', () => {
    expect(
      hasRecoveryContent({ ...empty, categories: [{ id: 1, name: 'Food' }] }, false)
    ).toBe(true);
  });

  it('counts Ask Renda only when the entry point is available', () => {
    const askRenda = { ...empty, ask_renda: { enabled: true, query: 'x' } };
    expect(hasRecoveryContent(askRenda, false)).toBe(false);
    expect(hasRecoveryContent(askRenda, true)).toBe(true);
  });
});
