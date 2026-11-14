export const CLIENT_TAB_IDS = [
  'ClientBrowse',
  'ClientSearch',
  'ClientReels',
  'ClientRentals',
  'ClientOrders',
  'ClientMenu',
] as const;

export type ClientTabId = (typeof CLIENT_TAB_IDS)[number];

/** Home · Reels · Rentals · Orders · Account when the tab flag is on and Reels is on. */
export function clientTabOrder(input: {
  reelsEnabled: boolean;
  rentalsTabEnabled: boolean;
}): ClientTabId[] {
  const tabs: ClientTabId[] = ['ClientBrowse'];
  if (!input.rentalsTabEnabled) tabs.push('ClientSearch');
  if (input.reelsEnabled) tabs.push('ClientReels');
  if (input.rentalsTabEnabled) tabs.push('ClientRentals');
  tabs.push('ClientOrders', 'ClientMenu');
  return tabs;
}
