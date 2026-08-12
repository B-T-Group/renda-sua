export type ReferredBusinessLifecycle =
  | 'created'
  | 'contract_signed'
  | 'active'
  | 'suspended';

export type ReferredBusinessFollowUpStatus =
  | 'contract_pending'
  | 'payment_setup_pending'
  | 'active'
  | 'suspended';

export interface ReferredBusinessFollowUp {
  businessId: string;
  businessName: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  phone?: string | null;
  email?: string | null;
  lifecycleStatus: ReferredBusinessLifecycle;
  followUpStatus: ReferredBusinessFollowUpStatus;
  itemsApproved: number;
  itemsRejected: number;
  itemsPending: number;
  createdAt: string;
}

export interface ReferredBusinessRow {
  id: string;
  name?: string | null;
  lifecycle_status?: string | null;
  created_at?: string | null;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    phone_number?: string | null;
    email?: string | null;
  } | null;
  items_approved?: { aggregate?: { count?: number } };
  items_rejected?: { aggregate?: { count?: number } };
  items_pending?: { aggregate?: { count?: number } };
  payment_accounts?: Array<{
    provider?: string | null;
    capability_status?: string | null;
  }>;
}

const LIFECYCLE: ReferredBusinessLifecycle[] = [
  'created',
  'contract_signed',
  'active',
  'suspended',
];

export function normalizeLifecycle(
  value: string | null | undefined
): ReferredBusinessLifecycle {
  const raw = String(value ?? '').toLowerCase();
  if ((LIFECYCLE as string[]).includes(raw)) {
    return raw as ReferredBusinessLifecycle;
  }
  return 'created';
}

export function isPaymentCapabilityVerified(
  accounts:
    | Array<{ provider?: string | null; capability_status?: string | null }>
    | undefined
): boolean {
  return (accounts ?? []).some((a) => a.capability_status === 'verified');
}

export function deriveFollowUpStatus(
  lifecycle: ReferredBusinessLifecycle,
  paymentVerified: boolean
): ReferredBusinessFollowUpStatus {
  if (lifecycle === 'suspended') return 'suspended';
  if (lifecycle === 'active') return 'active';
  if (lifecycle === 'created') return 'contract_pending';
  return paymentVerified ? 'active' : 'payment_setup_pending';
}

export function mapReferredBusinessRow(
  row: ReferredBusinessRow
): ReferredBusinessFollowUp {
  const lifecycle = normalizeLifecycle(row.lifecycle_status);
  return {
    businessId: row.id,
    businessName: row.name?.trim() || 'Business',
    ownerFirstName: row.user?.first_name ?? undefined,
    ownerLastName: row.user?.last_name ?? undefined,
    phone: row.user?.phone_number ?? null,
    email: row.user?.email ?? null,
    lifecycleStatus: lifecycle,
    followUpStatus: deriveFollowUpStatus(
      lifecycle,
      isPaymentCapabilityVerified(row.payment_accounts)
    ),
    itemsApproved: Number(row.items_approved?.aggregate?.count ?? 0),
    itemsRejected: Number(row.items_rejected?.aggregate?.count ?? 0),
    itemsPending: Number(row.items_pending?.aggregate?.count ?? 0),
    createdAt: row.created_at ?? '',
  };
}

export const REFERRED_BUSINESSES_LIST_SELECTION = `
  id
  name
  lifecycle_status
  created_at
  user {
    first_name
    last_name
    phone_number
    email
  }
  items_approved: items_aggregate(
    where: { moderation_status: { _eq: approved } }
  ) { aggregate { count } }
  items_rejected: items_aggregate(
    where: { moderation_status: { _eq: rejected } }
  ) { aggregate { count } }
  items_pending: items_aggregate(
    where: {
      moderation_status: { _in: [pending, ai_reviewing, proposal_pending] }
    }
  ) { aggregate { count } }
  payment_accounts { provider capability_status }
`;
