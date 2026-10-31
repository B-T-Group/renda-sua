export type SlotKey = 'morning' | 'afternoon' | 'evening';

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type PostingStatus = 'open' | 'filled' | 'closed' | 'expired';

export type ApplicationStatus = 'applied' | 'withdrawn' | 'accepted' | 'declined' | 'auto_declined';

export type AssignmentStatus = 'active' | 'paused';

export type AssignmentSource = 'posting_accept' | 'superuser_assign';

export type OpportunityIneligibleReason =
  | 'not_verified'
  | 'contract_unsigned'
  | 'suspended'
  | 'commercial_focus'
  | 'no_agent'
  | 'internal_agent'
  | 'no_address';

export interface PickupSlot {
  slotKey: SlotKey;
  startTime: string;
  endTime: string;
  isEnabled: boolean;
  pickupTime: string;
  liveAgents: number;
}

export interface DedicatedAgent {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  isInternal: boolean;
}

export interface DedicatedAgentCard {
  assignmentId: string;
  slotKey: SlotKey;
  status: AssignmentStatus;
  source: AssignmentSource;
  assignedByRendasua: boolean;
  offToday: boolean;
  /** #594 addendum AC-P16: `paused_slot_off` shows "Paused by agent" (older backends omit it). */
  pauseReason?: string | null;
  agent: DedicatedAgent;
  activeOrders: number;
  maxActiveOrders: number;
  outstandingDedicatedOffers: number;
  balanceCoversOrders: number | null;
  deliveries: number;
  missedDeliveries: number;
}

export interface DedicatedPostingView {
  id: string;
  locationId: string;
  status: PostingStatus;
  headcount: number;
  acceptedCount: number;
  slotKeys: SlotKey[];
  daysOfWeek: DayOfWeek[];
  terms: string | null;
  termsUpdatedAt: string;
  expiresAt: string;
  filledAt: string | null;
  closedAt: string | null;
  createdAt: string;
  pendingApplications: number;
}

export interface ApplicantAgent {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  joinedAt: string;
  isInternal: boolean;
}

export interface ApplicantCard {
  applicationId: string;
  status: ApplicationStatus;
  appliedAt: string;
  agent: ApplicantAgent;
  deliveriesCompleted: number;
  missedDeliveries: number;
  onTimePickupPct: number | null;
  distanceKm: number | null;
  phone?: string;
}

export interface DedicatedOpportunity {
  id: string;
  status: PostingStatus;
  storeName: string;
  address: {
    line1: string | null;
    city: string;
    state: string;
  };
  distanceKm: number | null;
  slots: Array<{
    slotKey: SlotKey;
    startTime: string;
    endTime: string;
    pickupTime: string;
  }>;
  pay: string;
  headcount: number;
  acceptedCount: number;
  daysOfWeek: DayOfWeek[];
  terms: string | null;
  application: {
    id: string;
    status: ApplicationStatus;
    appliedAt: string;
  } | null;
  termsUpdatedSinceApplied: boolean;
  disabledReason: 'holds_slot' | 'max_assignments' | null;
}

export interface MyDedicatedAssignment {
  assignmentId: string;
  locationId: string;
  storeName: string;
  slotKey: SlotKey;
  startTime: string;
  endTime: string;
  status: AssignmentStatus;
  source: AssignmentSource;
  offToday: boolean;
  activeOrders: number;
  maxActiveOrders: number;
  /** #594 addendum: why a paused row is paused (`paused_slot_off` = agent turned the slot off). */
  pauseReason?: string | null;
}

// ---------------------------------------------------------------------------
// #594 addendum: agent preferred delivery slots (/agents/me/slot-preferences)
// ---------------------------------------------------------------------------

export type SlotPreferences = Record<SlotKey, boolean>;

export interface SlotPreferencesResponse {
  success?: boolean;
  preferences: SlotPreferences;
  allOff: boolean;
  pausedAssignmentIds?: string[];
}

export interface UpdateSlotPreferencesRequest extends Partial<SlotPreferences> {
  confirmPause?: boolean;
}

/** 409 `slot_has_dedicated_assignments` body. */
export interface SlotOffConflict {
  code: 'slot_has_dedicated_assignments';
  slots: SlotKey[];
  stores: Array<{ assignmentId: string; locationId: string; storeName: string; slotKey: SlotKey }>;
}

export interface DedicatedAgentsCapability {
  enabled: boolean;
  country: string | null;
  reason: 'no_address' | 'no_country' | null;
}

export interface PickupSlotsResponse {
  success: true;
  slots: PickupSlot[];
}

export interface DedicatedAgentsResponse {
  success: true;
  maxActiveOrders: number;
  assignments: DedicatedAgentCard[];
}

export interface DedicatedPostingsResponse {
  success: true;
  postings: DedicatedPostingView[];
}

export interface DedicatedApplicationsResponse {
  success: true;
  posting: DedicatedPostingView;
  applications: ApplicantCard[];
}

export interface DedicatedOpportunitiesResponse {
  success: true;
  opportunities: DedicatedOpportunity[];
}

export interface DedicatedOpportunityResponse {
  success: true;
  opportunity: DedicatedOpportunity;
}

export interface MyDedicatedAssignmentsResponse {
  success: true;
  assignments: MyDedicatedAssignment[];
}

export interface DedicatedAgentsCapabilityResponse {
  success: true;
  enabled: boolean;
  country: string | null;
  reason: 'no_address' | 'no_country' | null;
}

export interface UpdatePickupSlotsRequest {
  slots: Array<{
    slotKey: SlotKey;
    pickupTime?: string | null;
    isEnabled?: boolean;
  }>;
  confirmPauseAgents?: boolean;
}

export interface CreatePostingRequest {
  headcount: number;
  slotKeys: SlotKey[];
  daysOfWeek: DayOfWeek[];
  terms?: string | null;
}

export interface UpdatePostingRequest {
  terms: string | null;
}

export interface ClosePostingRequest {
  reason?: string;
}

export interface UpdateAssignmentRequest {
  status: AssignmentStatus;
}

export interface UpdateOffTodayRequest {
  off: boolean;
}

export interface DeleteAssignmentRequest {
  reason?: string;
}

// ---------------------------------------------------------------------------
// Admin (platform.manage.agents) views: /admin/dedicated-agents/*
// ---------------------------------------------------------------------------

export interface AdminAssignmentView {
  assignmentId: string;
  slotKey: SlotKey;
  status: AssignmentStatus;
  /** #594 addendum AC-P17. */
  pauseReason?: string | null;
  preferredSlots?: SlotPreferences;
  source: AssignmentSource;
  createdAt: string;
  location: {
    id: string;
    name: string;
    businessId?: string;
    businessName: string;
    city: string;
    state: string;
    country?: string;
  };
  agent: DedicatedAgent;
  possible_relation: boolean;
  relation_signals: string[] | null;
  relation_dismissed: boolean;
}

export interface AdminAgentPickerItem {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  isInternal: boolean;
  chip: 'internal' | 'verified_independent';
  assignmentCount: number;
  activeOrders: number;
  outstandingDedicatedOffers: number;
  balanceCoversOrders: number | null;
}

export interface AdminLocationSearchItem {
  id: string;
  name: string;
  businessId: string;
  businessName: string;
  address: {
    line1: string | null;
    city: string;
    state: string;
    country: string;
  };
  enabledSlotKeys: SlotKey[];
  liveAgents: number;
}

export interface AdminAssignmentsResponse {
  success: true;
  assignments: AdminAssignmentView[];
  truncated?: boolean;
}

export interface AdminAgentPickerResponse {
  success: true;
  agents: AdminAgentPickerItem[];
  truncated: boolean;
}

export interface AdminLocationsResponse {
  success: true;
  locations: AdminLocationSearchItem[];
  truncated: boolean;
}

/** GET /admin/dedicated-agents/capability: countries in the admin's scope with the flag on. */
export interface AdminDedicatedCapabilityResponse {
  success: true;
  enabled: boolean;
  countries: string[];
}

/** GET /admin/dedicated-agents/coverage (covered vs uncovered slots per location; not rendered yet). */
export interface AdminCoverageResponse {
  success: true;
  truncated?: boolean;
  [key: string]: unknown;
}

export interface AdminAssignmentFilters {
  city?: string;
  locationId?: string;
  slotKey?: SlotKey;
  status?: AssignmentStatus | 'removed';
  source?: 'superuser_assign' | 'posting';
  /** #594 addendum AC-P17: agent has this preferred slot OFF. */
  prefOff?: SlotKey;
  pauseReason?: 'paused_slot_off';
}

export interface CreateAdminAssignmentRequest {
  locationId: string;
  agentId: string;
  slotKeys: SlotKey[];
}

export interface CreateAdminAssignmentResponse {
  success: true;
  assignments: Array<{
    id: string;
    agent_id: string;
    slot_key: SlotKey;
    status: string;
    source: string;
  }>;
}
