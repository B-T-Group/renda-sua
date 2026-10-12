import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { normalizeAgentCountry } from './agent-contract-templates';

export interface AgentContractProfile {
  userId: string;
  agentId: string;
  agentCode: string | null;
  email: string;
  phone: string;
  signerName: string;
  preferredLanguage: string | null;
  country: string | null;
  addressCountry: string | null;
  addressLine: string | null;
  city: string | null;
  referralCode: string | null;
}

interface AddressRow {
  country?: string | null;
  city?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  is_primary?: boolean | null;
}

@Injectable()
export class AgentContractProfileService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async forUser(userId: string): Promise<AgentContractProfile | null> {
    const res = await this.hasura.executeQuery<{ users_by_pk: UserRow | null }>(
      PROFILE_QUERY,
      { userId }
    );
    return res.users_by_pk ? toProfile(res.users_by_pk) : null;
  }

  async forAgent(agentId: string): Promise<AgentContractProfile | null> {
    const res = await this.hasura.executeQuery<{
      agents_by_pk: { user: UserRow | null } | null;
    }>(AGENT_PROFILE_QUERY, { agentId });
    const user = res.agents_by_pk?.user;
    return user?.agent ? toProfile(user) : null;
  }
}

interface UserRow {
  id: string;
  email?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  preferred_language?: string | null;
  country?: string | null;
  agent: {
    id: string;
    agent_code?: string | null;
    referral_code_used?: string | null;
    agent_addresses?: Array<{ address: AddressRow | null }>;
  } | null;
}

function toProfile(user: UserRow): AgentContractProfile | null {
  if (!user.agent) return null;
  const address = primaryAddress(user.agent.agent_addresses);
  return {
    userId: user.id,
    agentId: user.agent.id,
    agentCode: user.agent.agent_code ?? null,
    email: user.email?.trim() ?? '',
    phone: user.phone_number?.trim() ?? '',
    signerName: signerName(user),
    preferredLanguage: user.preferred_language ?? null,
    country: user.country ?? null,
    addressCountry: address?.country ?? null,
    addressLine: joinAddress(address),
    city: address?.city?.trim() || null,
    referralCode: user.agent.referral_code_used?.trim() || null,
  };
}

function signerName(user: UserRow): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
}

function primaryAddress(
  rows?: Array<{ address: AddressRow | null }>
): AddressRow | null {
  const addresses = (rows ?? []).map((row) => row.address).filter(Boolean);
  return addresses.find((row) => row?.is_primary) ?? addresses[0] ?? null;
}

function joinAddress(address: AddressRow | null): string | null {
  const line = [address?.address_line_1, address?.address_line_2]
    .filter((part) => part?.trim())
    .join(', ');
  return line || null;
}

export function displayCountry(
  profile: AgentContractProfile,
  locale: 'en' | 'fr'
): string | null {
  const code =
    normalizeAgentCountry(profile.country) ??
    normalizeAgentCountry(profile.addressCountry);
  if (!code) return null;
  return COUNTRY_LABELS[code]?.[locale] ?? code;
}

const COUNTRY_LABELS: Record<string, { en: string; fr: string }> = {
  CA: { en: 'Canada', fr: 'Canada' },
  CM: { en: 'Cameroon', fr: 'Cameroun' },
  GA: { en: 'Gabon', fr: 'Gabon' },
  CG: { en: 'Congo', fr: 'Congo' },
  TD: { en: 'Chad', fr: 'Tchad' },
  CF: { en: 'Central African Republic', fr: 'République centrafricaine' },
  GQ: { en: 'Equatorial Guinea', fr: 'Guinée équatoriale' },
  TG: { en: 'Togo', fr: 'Togo' },
  BJ: { en: 'Benin', fr: 'Bénin' },
  CI: { en: "Côte d'Ivoire", fr: "Côte d'Ivoire" },
  US: { en: 'United States', fr: 'États-Unis' },
  PH: { en: 'Philippines', fr: 'Philippines' },
};

const PROFILE_FIELDS = `
  id email phone_number first_name last_name preferred_language country
  agent {
    id agent_code referral_code_used
    agent_addresses(where: { address: { status: { _eq: active } } }) {
      address { country city address_line_1 address_line_2 is_primary }
    }
  }
`;

const PROFILE_QUERY = `
  query AgentContractProfile($userId: uuid!) {
    users_by_pk(id: $userId) { ${PROFILE_FIELDS} }
  }
`;

const AGENT_PROFILE_QUERY = `
  query AgentContractProfileByAgent($agentId: uuid!) {
    agents_by_pk(id: $agentId) { user { ${PROFILE_FIELDS} } }
  }
`;
