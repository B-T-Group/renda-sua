import { AppEventsService } from '../../services/analytics/AppEventsService';
import type { MyRentalsSegment } from './myRentalsEntry';

export type ClientRentalsBrowseSource = 'header_icon' | 'empty_cta';

export function trackRentalsClientTabTap(input: {
  segment: MyRentalsSegment;
  todoCount: number;
}): void {
  AppEventsService.track({
    eventType: 'rentals_client_tab_tap',
    metadata: {
      source: 'tab',
      segment: input.segment,
      todo_count: input.todoCount,
    },
  });
}

export function trackRentalsClientTabBrowseTap(source: ClientRentalsBrowseSource): void {
  AppEventsService.track({
    eventType: 'rentals_client_tab_browse_tap',
    metadata: { source },
  });
}
