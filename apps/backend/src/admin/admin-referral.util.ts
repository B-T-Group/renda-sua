export type AdminReferredBy = {
  kind: 'agent' | 'business';
  name: string;
  codeUsed: string | null;
};

export function pickReferralCode(
  userCode?: string | null,
  legacyCode?: string | null
): string {
  const user = userCode?.trim();
  if (user) return user;
  return legacyCode?.trim() ?? '';
}

export function mapAdminReferredBy(
  referringAgent: { user?: { first_name?: string | null; last_name?: string | null } } | null | undefined,
  referringBusiness: { name?: string | null } | null | undefined,
  codeUsed?: string | null,
  referredByAgentId?: string | null,
  referredByBusinessId?: string | null
): AdminReferredBy | null {
  const agentName = `${referringAgent?.user?.first_name ?? ''} ${
    referringAgent?.user?.last_name ?? ''
  }`.trim();
  if (referringAgent || referredByAgentId) {
    return { kind: 'agent', name: agentName || 'Agent', codeUsed: codeUsed ?? null };
  }
  const businessName = referringBusiness?.name?.trim();
  if (referringBusiness || referredByBusinessId) {
    return {
      kind: 'business',
      name: businessName || 'Business',
      codeUsed: codeUsed ?? null,
    };
  }
  return null;
}

export function hasExistingReferrer(row: {
  referred_by_agent_id?: string | null;
  referred_by_business_id?: string | null;
}): boolean {
  return Boolean(row.referred_by_agent_id || row.referred_by_business_id);
}
