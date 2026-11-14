import { describe, expect, it } from 'vitest';
import { DEFAULT_CLIENT_FLAGS } from '../services/clientFlagsApi';
import { clientTabOrder } from './clientTabOrder';

describe('clientTabOrder', () => {
  it('keeps Home · Search · Reels · Orders · Account when the Rentals tab is off', () => {
    expect(clientTabOrder({ reelsEnabled: true, rentalsTabEnabled: false })).toEqual([
      'ClientBrowse',
      'ClientSearch',
      'ClientReels',
      'ClientOrders',
      'ClientMenu',
    ]);
    expect(clientTabOrder({ reelsEnabled: false, rentalsTabEnabled: false })).toEqual([
      'ClientBrowse',
      'ClientSearch',
      'ClientOrders',
      'ClientMenu',
    ]);
  });

  it('drops Search and puts Rentals in the middle when the tab is on', () => {
    expect(clientTabOrder({ reelsEnabled: true, rentalsTabEnabled: true })).toEqual([
      'ClientBrowse',
      'ClientReels',
      'ClientRentals',
      'ClientOrders',
      'ClientMenu',
    ]);
    expect(clientTabOrder({ reelsEnabled: false, rentalsTabEnabled: true })).toEqual([
      'ClientBrowse',
      'ClientRentals',
      'ClientOrders',
      'ClientMenu',
    ]);
  });

  it('defaults the client tab flag off', () => {
    expect(DEFAULT_CLIENT_FLAGS.rentals_client_tab_enabled).toBe(false);
  });
});
