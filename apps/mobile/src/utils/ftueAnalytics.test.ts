import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/analytics/AppEventsService', () => ({
  AppEventsService: { track: vi.fn() },
}));

vi.mock('./ftueExperiments', () => ({
  getExperimentVariant: () => 'after_slide_1',
}));

import { AppEventsService } from '../services/analytics/AppEventsService';
import { resetHeroSlideViewTracking, trackHeroSlideViewed } from './ftueAnalytics';

describe('trackHeroSlideViewed', () => {
  afterEach(() => {
    resetHeroSlideViewTracking();
    vi.mocked(AppEventsService.track).mockClear();
  });

  it('posts once per slide even if autoplay loops', () => {
    trackHeroSlideViewed('grow_business', 0, { persona_intent: 'sell' });
    trackHeroSlideViewed('grow_business', 0, { persona_intent: 'sell' });
    trackHeroSlideViewed('buy_local', 1, { persona_intent: 'sell' });
    expect(AppEventsService.track).toHaveBeenCalledTimes(2);
    expect(vi.mocked(AppEventsService.track).mock.calls[0][0]).toMatchObject({
      eventType: 'ftue.hero.slide_viewed',
      metadata: { slide_id: 'grow_business', position: 0, persona_intent: 'sell' },
    });
  });
});
