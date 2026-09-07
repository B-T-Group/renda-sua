/**
 * Market analytics events.
 * Fire-and-forget — errors are silently swallowed so they never affect UX.
 */

import { AppEventsService } from '../services/analytics/AppEventsService';

export type MarketEventName =
  | 'market_auto_detected'
  | 'market_changed'
  | 'market_change_prompt_shown'
  | 'market_change_prompt_accepted'
  | 'market_change_prompt_dismissed';

const EVENT_TYPE_MAP: Record<MarketEventName, string> = {
  market_auto_detected: 'market.auto_detected',
  market_changed: 'market.changed',
  market_change_prompt_shown: 'market.change_prompt_shown',
  market_change_prompt_accepted: 'market.change_prompt_accepted',
  market_change_prompt_dismissed: 'market.change_prompt_dismissed',
};

export interface MarketEventProperties {
  countryCode?: string;
  previousCountryCode?: string;
  mode?: string;
}

export function trackMarketEvent(
  event: MarketEventName,
  properties: MarketEventProperties = {}
): void {
  AppEventsService.track({
    eventType: EVENT_TYPE_MAP[event],
    metadata: { ...properties, source: 'mobile' },
  });
}
