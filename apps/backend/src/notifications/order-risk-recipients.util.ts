export interface PlatformRoleHolder {
  userId: string;
  email: string | null;
  preferredLanguage?: string | null;
  /** ISO alpha-2; null/blank means global ops who receive every market. */
  country?: string | null;
  roles: string[];
}

export interface OrderRiskRecipient {
  userId: string;
  /** Null suppresses the email channel for this recipient. */
  email: string | null;
  /** Raw preferred language; drives which WhatsApp translation Meta is asked for. */
  preferredLanguage: string | null;
}

/**
 * Everyone who can act on an at-risk order: platform staff holding one of
 * `roleKeys`, plus the agent who referred the merchant.
 *
 * When `orderCountryCode` is set, only staff in that country (or with no
 * country = global ops) are included. Staff in a different country are never
 * paged. When the order has no country, all matching roles stay (legacy).
 *
 * When `singleStaffRecipient` is true (order-risk escalations), at most one
 * matching staff member is kept — chosen at random — so we do not page every
 * superuser/order manager. The referring agent is still appended when distinct.
 *
 * The referring agent deliberately gets no email. The alert email points at the
 * admin panel they cannot open, so their actionable channels are push and
 * WhatsApp. A referrer who is also staff keeps their staff email and is only
 * notified once.
 */
export function buildOrderRiskRecipients(params: {
  staff: PlatformRoleHolder[];
  roleKeys: string[];
  orderCountryCode?: string | null;
  referringAgentUserId?: string | null;
  referringAgentLanguage?: string | null;
  /** When true, page one random matching staff member instead of all of them. */
  singleStaffRecipient?: boolean;
  /** Test seam for deterministic staff selection (0 <= n < 1). */
  random?: () => number;
}): OrderRiskRecipient[] {
  const orderCountry = normalizeCountry(params.orderCountryCode);
  let recipients = params.staff
    .filter((user) => user.roles.some((role) => params.roleKeys.includes(role)))
    .filter((user) => staffMatchesOrderCountry(user.country, orderCountry))
    .map((user) => ({
      userId: user.userId,
      email: user.email,
      preferredLanguage: user.preferredLanguage ?? null,
    }));

  if (params.singleStaffRecipient && recipients.length > 1) {
    recipients = [pickRandomRecipient(recipients, params.random)];
  }

  const agentUserId = params.referringAgentUserId?.trim();
  if (!agentUserId || recipients.some((r) => r.userId === agentUserId)) {
    return recipients;
  }
  return [
    ...recipients,
    {
      userId: agentUserId,
      email: null,
      preferredLanguage: params.referringAgentLanguage ?? null,
    },
  ];
}

function pickRandomRecipient(
  recipients: OrderRiskRecipient[],
  random: () => number = Math.random
): OrderRiskRecipient {
  const index = Math.floor(random() * recipients.length);
  return recipients[Math.min(Math.max(index, 0), recipients.length - 1)];
}

export function staffMatchesOrderCountry(
  staffCountry: string | null | undefined,
  orderCountry: string | null
): boolean {
  if (!orderCountry) return true;
  const staff = normalizeCountry(staffCountry);
  if (!staff) return true;
  return staff === orderCountry;
}

function normalizeCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}
