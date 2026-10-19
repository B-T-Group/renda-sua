export const LOCATION_DELEGATIONS_FLAG_KEY = 'location_delegations';

export const DELEGATION_PERMISSIONS = {
  ORDERS_READ: 'delegation.orders.read',
  ORDERS_MANAGE: 'delegation.orders.manage',
  ITEMS_READ: 'delegation.items.read',
  ITEMS_MANAGE: 'delegation.items.manage',
  /** #594: pickup slots, dedicated agents, postings and applicants (seeded by 20261018180000). */
  DEDICATED_AGENTS_MANAGE: 'delegation.dedicated_agents.manage',
} as const;

export const DELEGATION_HEADER = 'x-active-delegation';

export const INVITE_TTL_DAYS = 7;
