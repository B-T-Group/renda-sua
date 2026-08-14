export const LOCATION_DELEGATIONS_FLAG_KEY = 'location_delegations';

export const DELEGATION_PERMISSIONS = {
  ORDERS_READ: 'delegation.orders.read',
  ORDERS_MANAGE: 'delegation.orders.manage',
  ITEMS_READ: 'delegation.items.read',
  ITEMS_MANAGE: 'delegation.items.manage',
} as const;

export const DELEGATION_HEADER = 'x-active-delegation';

export const INVITE_TTL_DAYS = 7;
