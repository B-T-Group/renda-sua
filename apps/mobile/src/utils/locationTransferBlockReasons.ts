/** Maps API block reason codes to i18n key + English default. */
export const TRANSFER_BLOCK_REASON_KEYS: Record<string, [string, string]> = {
  DESTINATION_SAME_AS_SOURCE: [
    'business.locations.transfer.block.sameBusiness',
    'Cannot transfer to the same business',
  ],
  PRIMARY_LOCATION: [
    'business.locations.transfer.block.primary',
    'Cannot transfer the primary location',
  ],
  ONLY_LOCATION: [
    'business.locations.transfer.block.only',
    'Cannot transfer the only location',
  ],
  ITEMS_USED_IN_OTHER_LOCATIONS: [
    'business.locations.transfer.block.sharedItems',
    'Some items are used in other locations',
  ],
  RENTALS_USED_IN_OTHER_LOCATIONS: [
    'business.locations.transfer.block.sharedRentals',
    'Some rental items are listed at other locations',
  ],
  ONGOING_ORDERS: [
    'business.locations.transfer.block.ongoingOrders',
    'This location has ongoing orders',
  ],
  ONGOING_RENTALS: [
    'business.locations.transfer.block.ongoingRentals',
    'This location has ongoing rentals',
  ],
  SKU_COLLISION: [
    'business.locations.transfer.block.skuCollision',
    'Destination already has items with the same SKU',
  ],
  NO_MOVABLE_INVENTORY: [
    'business.locations.transfer.block.noMovable',
    'No inventory can be moved (all items skipped or empty)',
  ],
};

export function transferBlockReasonKey(code: string): [string, string] {
  return (
    TRANSFER_BLOCK_REASON_KEYS[code] ?? [
      'business.locations.transfer.block.unknown',
      code,
    ]
  );
}
