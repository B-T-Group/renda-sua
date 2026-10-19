/** #594 dedicated delivery agents + pickup slots. Keys seeded by 20261018180000_dedicated_agents_schema. */
export const DEDICATED_AGENTS_FLAG_KEY = 'dedicated_agents_enabled';

export const DEDICATED_SLOT_KEYS = ['morning', 'afternoon', 'evening'] as const;
export type DedicatedSlotKey = (typeof DEDICATED_SLOT_KEYS)[number];

export const DEDICATED_ASSIGNMENT_STATUSES = ['active', 'paused', 'removed'] as const;
export type DedicatedAssignmentStatus =
  (typeof DEDICATED_ASSIGNMENT_STATUSES)[number];

export const DEDICATED_ASSIGNMENT_SOURCES = ['superuser_assign', 'posting'] as const;
export type DedicatedAssignmentSource =
  (typeof DEDICATED_ASSIGNMENT_SOURCES)[number];

export const DEDICATED_POSTING_STATUSES = ['open', 'filled', 'closed', 'expired'] as const;
export type DedicatedPostingStatus = (typeof DEDICATED_POSTING_STATUSES)[number];

export const DEDICATED_APPLICATION_STATUSES = [
  'applied',
  'withdrawn',
  'accepted',
  'declined',
  'auto_declined',
] as const;
export type DedicatedApplicationStatus =
  (typeof DEDICATED_APPLICATION_STATUSES)[number];

export const ORDER_ASSIGNMENT_SOURCES = [
  'offer',
  'open_claim',
  'dedicated_offer',
  'dedicated_auto',
  'admin',
] as const;
export type OrderAssignmentSource = (typeof ORDER_ASSIGNMENT_SOURCES)[number];

export const ORDER_OFFER_KINDS = ['standard', 'dedicated'] as const;
export type OrderOfferKind = (typeof ORDER_OFFER_KINDS)[number];

export const OFFER_DECLINE_REASONS = [
  'too_far',
  'busy',
  'not_enough_balance',
  'other',
] as const;
export type OfferDeclineReason = (typeof OFFER_DECLINE_REASONS)[number];

/** Number keys -> config field, with the seeded default and the accepted range. */
export const DEDICATED_NUMBER_CONFIG = {
  dedicated_offer_ttl_seconds: { field: 'offerTtlSeconds', fallback: 120, min: 30, max: 900 },
  dedicated_max_active_orders: { field: 'maxActiveOrders', fallback: 10, min: 1, max: 50 },
  dedicated_max_assignments_per_agent: { field: 'maxAssignmentsPerAgent', fallback: 3, min: 1, max: 20 },
  dedicated_auto_assign_release_seconds: { field: 'autoAssignReleaseSeconds', fallback: 120, min: 0, max: 900 },
  dedicated_slot_reminder_minutes: { field: 'slotReminderMinutes', fallback: 30, min: 0, max: 240 },
  dedicated_posting_expiry_days: { field: 'postingExpiryDays', fallback: 14, min: 1, max: 90 },
  dedicated_slot_end_grace_minutes: { field: 'slotEndGraceMinutes', fallback: 15, min: 0, max: 120 },
} as const;

export type DedicatedNumberConfigKey = keyof typeof DEDICATED_NUMBER_CONFIG;
export const DEDICATED_CONFIG_KEYS = [
  DEDICATED_AGENTS_FLAG_KEY,
  ...(Object.keys(DEDICATED_NUMBER_CONFIG) as DedicatedNumberConfigKey[]),
] as const;

export interface DedicatedAgentsConfig {
  enabled: boolean;
  offerTtlSeconds: number;
  maxActiveOrders: number;
  maxAssignmentsPerAgent: number;
  autoAssignReleaseSeconds: number;
  slotReminderMinutes: number;
  postingExpiryDays: number;
  slotEndGraceMinutes: number;
}

/** Used when the config rows are missing or unreadable: the feature stays off. */
export const DEFAULT_DEDICATED_AGENTS_CONFIG: DedicatedAgentsConfig = {
  enabled: false,
  offerTtlSeconds: 120,
  maxActiveOrders: 10,
  maxAssignmentsPerAgent: 3,
  autoAssignReleaseSeconds: 120,
  slotReminderMinutes: 30,
  postingExpiryDays: 14,
  slotEndGraceMinutes: 15,
};

/** In-app / push paths of the dedicated-agent notices (PR 3; the PR 6 slot reminder reuses the agent one). */
export const DEDICATED_BUSINESS_NOTICE_PATH = (locationId: string) =>
  `/business/locations/${locationId}/dedicated-agents`;
export const DEDICATED_AGENT_NOTICE_PATH = '/agent/dedicated-assignments';
