export interface PlatformRoleHolder {
  userId: string;
  email: string | null;
  roles: string[];
}

export interface OrderRiskRecipient {
  userId: string;
  /** Null suppresses the email channel for this recipient. */
  email: string | null;
}

/**
 * Everyone who can act on an at-risk order: platform staff holding one of
 * `roleKeys`, plus the agent who referred the merchant.
 *
 * The referring agent deliberately gets no email. The alert email points at the
 * admin panel they cannot open, so their actionable channels are push and
 * WhatsApp. A referrer who is also staff keeps their staff email and is only
 * notified once.
 */
export function buildOrderRiskRecipients(params: {
  staff: PlatformRoleHolder[];
  roleKeys: string[];
  referringAgentUserId?: string | null;
}): OrderRiskRecipient[] {
  const recipients = params.staff
    .filter((user) => user.roles.some((role) => params.roleKeys.includes(role)))
    .map((user) => ({ userId: user.userId, email: user.email }));

  const agentUserId = params.referringAgentUserId?.trim();
  if (!agentUserId || recipients.some((r) => r.userId === agentUserId)) {
    return recipients;
  }
  return [...recipients, { userId: agentUserId, email: null }];
}
