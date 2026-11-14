import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEventsService } from '../../services/analytics/AppEventsService';
import {
  trackRentalsClientTabBrowseTap,
  trackRentalsClientTabTap,
} from './clientRentalsTabAnalytics';

vi.mock('../../services/analytics/AppEventsService', () => ({
  AppEventsService: { track: vi.fn() },
}));

describe('client rentals tab analytics', () => {
  beforeEach(() => {
    vi.mocked(AppEventsService.track).mockClear();
  });

  it('records a tab tap with the segment and the to-do count', () => {
    trackRentalsClientTabTap({ segment: 'action_needed', todoCount: 2 });
    expect(AppEventsService.track).toHaveBeenCalledWith({
      eventType: 'rentals_client_tab_tap',
      metadata: { source: 'tab', segment: 'action_needed', todo_count: 2 },
    });
  });

  it('records browse taps from the header and the empty state', () => {
    trackRentalsClientTabBrowseTap('header_icon');
    trackRentalsClientTabBrowseTap('empty_cta');
    expect(AppEventsService.track).toHaveBeenNthCalledWith(1, {
      eventType: 'rentals_client_tab_browse_tap',
      metadata: { source: 'header_icon' },
    });
    expect(AppEventsService.track).toHaveBeenNthCalledWith(2, {
      eventType: 'rentals_client_tab_browse_tap',
      metadata: { source: 'empty_cta' },
    });
  });
});
