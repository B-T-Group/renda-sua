import { AppEventsService } from '../../services/analytics/AppEventsService';

export type MyRentalsEntrySource = 'header_icon' | 'next_card';

export function trackMyRentalsEntryTap(source: MyRentalsEntrySource): void {
  AppEventsService.track({
    eventType: 'rentals_my_rentals_entry_tap',
    metadata: { source },
  });
}

export function trackNextRentalCardImpression(): void {
  AppEventsService.track({
    eventType: 'next_rental_card_impression',
    metadata: { source: 'next_card' },
  });
}
