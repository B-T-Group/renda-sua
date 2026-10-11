/**
 * Discovery analytics events (#342).
 * Fire-and-forget — errors are silently swallowed so they never affect UX.
 */

import { AppEventsService } from '../services/analytics/AppEventsService';
import type { DiscoverySortMode, RecoveryRung } from '../types/inventoryCatalog';

export type DiscoveryEventName =
  | 'search_results_shown'
  | 'search_sort_changed'
  | 'search_empty_shown'
  | 'search_empty_rung_clicked'
  | 'search_filter_removed_from_empty'
  | 'card_rating_shown';

const EVENT_TYPE_MAP: Record<DiscoveryEventName, string> = {
  search_results_shown: 'search.results_shown',
  search_sort_changed: 'search.sort_changed',
  search_empty_shown: 'search.empty_shown',
  search_empty_rung_clicked: 'search.empty_rung_clicked',
  search_filter_removed_from_empty: 'search.filter_removed_from_empty',
  card_rating_shown: 'card.rating_shown',
};

export interface SearchResultsShownProperties {
  query_len: number;
  count: number;
  mode: DiscoverySortMode;
}

export interface SearchSortChangedProperties {
  from: DiscoverySortMode;
  to: DiscoverySortMode;
  surface: 'browse' | 'search';
}

export interface SearchEmptyRungClickedProperties {
  rung: RecoveryRung;
}

export function trackDiscoveryEvent(
  event: DiscoveryEventName,
  properties?:
    | SearchResultsShownProperties
    | SearchSortChangedProperties
    | SearchEmptyRungClickedProperties
): void {
  AppEventsService.track({
    eventType: EVENT_TYPE_MAP[event],
    metadata: { ...properties, source: 'mobile' },
  });
}
