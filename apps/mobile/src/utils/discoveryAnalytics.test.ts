import { describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('../services/analytics/AppEventsService', () => ({ AppEventsService: { track } }));

import { trackDiscoveryEvent } from './discoveryAnalytics';
import { DEFAULT_CLIENT_FLAGS } from '../services/clientFlagsApi';
import { searchRecoveryPath } from '../services/inventoryItemsApi';

describe('discovery (#342)', () => {
  it('flag defaults to false', () => {
    expect(DEFAULT_CLIENT_FLAGS.discovery_sort_v1).toBe(false);
  });

  it('maps events to contract names and never sends query text', () => {
    trackDiscoveryEvent('search_results_shown', { query_len: 4, count: 2, mode: 'popular' });
    trackDiscoveryEvent('card_rating_shown');
    expect(track.mock.calls[0][0].eventType).toBe('search.results_shown');
    expect(track.mock.calls[0][0].metadata).toEqual({
      query_len: 4,
      count: 2,
      mode: 'popular',
      source: 'mobile',
    });
    expect(track.mock.calls[1][0].eventType).toBe('card.rating_shown');
  });

  it('builds the recovery path with contract params', () => {
    const path = searchRecoveryPath({ search: ' tv ', brand: 'Acme', country_code: 'CM', food_only: true });
    expect(path).toBe(
      '/inventory-items/search/recovery?search=tv&brand=Acme&country_code=CM&food_only=true'
    );
  });
});
