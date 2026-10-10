import { Injectable, Logger } from '@nestjs/common';
import * as libphonenumber from 'google-libphonenumber';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type {
  AssistantIdentity,
  AssistantLocale,
  AssistantMarket,
} from './assistant.types';

interface UserIdentityRow {
  id: string;
  first_name: string | null;
  last_name?: string | null;
  email?: string | null;
  preferred_language: string | null;
  phone_number: string | null;
  user_type_id: string | null;
  client?: { id: string } | null;
  agent?: { id: string } | null;
  business?: { id: string } | null;
}

interface AddressRow {
  country: string;
  state: string | null;
  is_primary: boolean;
}

@Injectable()
export class AssistantIdentityService {
  private readonly logger = new Logger(AssistantIdentityService.name);
  private readonly phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

  constructor(private readonly hasura: HasuraSystemService) {}

  async resolveFromPhone(phone: string): Promise<AssistantIdentity> {
    const normalized = phone.replace(/^\+/, '').trim();
    const country = this.inferCountryFromPhone(normalized);
    if (!normalized) return this.anonymous(null, null, country);
    const user = await this.findByPhone(normalized);
    if (!user) return this.anonymous(normalized, null, country);
    const phone164 = normalized;
    const market = await this.resolveMarketFromUser(user, country);
    return this.fromUser(user, phone164, market, null, null);
  }

  async resolveFromUserId(
    userId: string | null | undefined,
    marketContext?: AssistantMarket | null,
    activePersona?: string | null,
    activeDelegation?: string | null
  ): Promise<AssistantIdentity> {
    if (!userId || userId === 'anonymous') {
      return this.anonymous(null, marketContext, null);
    }
    const user = await this.findById(userId);
    if (!user) return this.anonymous(null, marketContext, null);
    const phone = user.phone_number?.replace(/^\+/, '').trim() || null;
    const phoneCountry = this.inferCountryFromPhone(phone || '');
    const market = await this.resolveMarketFromUser(user, phoneCountry, marketContext);
    return this.fromUser(user, phone, market, activePersona ?? null, activeDelegation);
  }

  /**
   * Resolves market in priority order:
   * 1. marketContext (from client)
   * 2. Primary address from user's profile
   * 3. Phone-inferred country
   */
  private async resolveMarketFromUser(
    user: UserIdentityRow,
    phoneCountry: string | null,
    marketContext?: AssistantMarket | null
  ): Promise<AssistantMarket | null> {
    if (marketContext) {
      return {
        country_code: marketContext.country_code.toUpperCase(),
        state: marketContext.state,
      };
    }
    const addressMarket = await this.getPrimaryAddressMarket(user);
    if (addressMarket) return addressMarket;
    if (phoneCountry) return { country_code: phoneCountry };
    return null;
  }

  private async getPrimaryAddressMarket(
    user: UserIdentityRow
  ): Promise<AssistantMarket | null> {
    if (user.client?.id) {
      return this.getClientPrimaryAddress(user.client.id);
    }
    if (user.agent?.id) {
      return this.getAgentPrimaryAddress(user.agent.id);
    }
    if (user.business?.id) {
      return this.getBusinessPrimaryAddress(user.business.id);
    }
    return null;
  }

  private async getClientPrimaryAddress(
    clientId: string
  ): Promise<AssistantMarket | null> {
    const result = await this.hasura.executeQuery<{
      addresses: AddressRow[];
    }>(
      `query GetClientPrimaryAddress($clientId: uuid!) {
        addresses(
          where: {
            client_addresses: { client_id: { _eq: $clientId } }
            status: { _eq: active }
            is_primary: { _eq: true }
          }
          limit: 1
        ) { country state is_primary }
      }`,
      { clientId }
    );
    return this.toMarket(result.addresses?.[0]);
  }

  private async getAgentPrimaryAddress(
    agentId: string
  ): Promise<AssistantMarket | null> {
    const result = await this.hasura.executeQuery<{
      addresses: AddressRow[];
    }>(
      `query GetAgentPrimaryAddress($agentId: uuid!) {
        addresses(
          where: {
            agent_addresses: { agent_id: { _eq: $agentId } }
            status: { _eq: active }
            is_primary: { _eq: true }
          }
          limit: 1
        ) { country state is_primary }
      }`,
      { agentId }
    );
    return this.toMarket(result.addresses?.[0]);
  }

  private async getBusinessPrimaryAddress(
    businessId: string
  ): Promise<AssistantMarket | null> {
    const result = await this.hasura.executeQuery<{
      addresses: AddressRow[];
    }>(
      `query GetBusinessPrimaryAddress($businessId: uuid!) {
        addresses(
          where: {
            business_addresses: { business_id: { _eq: $businessId } }
            status: { _eq: active }
            is_primary: { _eq: true }
          }
          limit: 1
        ) { country state is_primary }
      }`,
      { businessId }
    );
    return this.toMarket(result.addresses?.[0]);
  }

  private toMarket(address: AddressRow | undefined): AssistantMarket | null {
    if (!address?.country) return null;
    return {
      country_code: address.country.toUpperCase(),
      state: address.state || undefined,
    };
  }

  anonymous(
    phoneE164: string | null = null,
    market: AssistantMarket | null = null,
    phoneCountry: string | null = null
  ): AssistantIdentity {
    return {
      isVerified: false,
      userId: null,
      firstName: null,
      preferredLanguage: null,
      market: market || (phoneCountry ? { country_code: phoneCountry } : null),
      country: market?.country_code || phoneCountry,
      phoneE164,
      accountType: null,
      clientId: null,
      agentId: null,
      businessId: null,
      lastName: null,
      email: null,
    };
  }

  inferCountryFromPhone(phone: string): string | null {
    if (!phone) return null;
    try {
      const parsed = this.phoneUtil.parse(phone.startsWith('+') ? phone : `+${phone}`);
      return this.phoneUtil.getRegionCodeForNumber(parsed)?.toUpperCase() || null;
    } catch (error: any) {
      this.logger.debug(`Phone country inference failed: ${error.message}`);
      return null;
    }
  }

  private async findByPhone(phone: string): Promise<UserIdentityRow | null> {
    const result = await this.hasura.executeQuery<{ users: UserIdentityRow[] }>(
      `${USER_QUERY_PREFIX}($a: String!, $b: String!) {
        users(where: { _or: [
          { phone_number: { _eq: $a } }, { phone_number: { _eq: $b } }
        ]}, limit: 1) { ${USER_FIELDS} }
      }`,
      { a: phone, b: `+${phone}` }
    );
    return result.users?.[0] ?? null;
  }

  private async findById(userId: string): Promise<UserIdentityRow | null> {
    const result = await this.hasura.executeQuery<{ users: UserIdentityRow[] }>(
      `${USER_QUERY_PREFIX}($id: uuid!) {
        users(where: { id: { _eq: $id } }, limit: 1) { ${USER_FIELDS} }
      }`,
      { id: userId }
    );
    return result.users?.[0] ?? null;
  }

  private fromUser(
    user: UserIdentityRow,
    phoneE164: string | null,
    market: AssistantMarket | null,
    activePersona: string | null,
    activeDelegation: string | null
  ): AssistantIdentity {
    return {
      isVerified: true,
      userId: user.id,
      firstName: user.first_name?.trim() || null,
      lastName: user.last_name?.trim() || null,
      email: user.email?.trim() || null,
      preferredLanguage: normalizeLocale(user.preferred_language),
      market,
      country: market?.country_code || null,
      phoneE164,
      accountType: resolveAccountType(user, activePersona, activeDelegation),
      clientId: user.client?.id ?? null,
      agentId: user.agent?.id ?? null,
      businessId: user.business?.id ?? null,
    };
  }
}

const USER_QUERY_PREFIX = 'query AssistantUser';
const USER_FIELDS = `
  id first_name last_name email preferred_language phone_number user_type_id
  client { id } agent { id } business { id }
`;

function normalizeLocale(value: string | null): AssistantLocale | null {
  if (value?.toLowerCase().startsWith('fr')) return 'fr';
  if (value?.toLowerCase().startsWith('en')) return 'en';
  return null;
}

function resolveAccountType(
  user: UserIdentityRow,
  activePersona?: string | null,
  activeDelegation?: string | null
): string | null {
  if (activeDelegation?.trim()) return 'delegate';
  const persona = activePersona?.toLowerCase();
  if (persona === 'delegate') return 'delegate';
  if (persona === 'client' && user.client?.id) return 'client';
  if (persona === 'agent' && user.agent?.id) return 'agent';
  if (persona === 'business' && user.business?.id) return 'business';
  if (user.business?.id) return 'business';
  if (user.agent?.id) return 'agent';
  if (user.client?.id) return 'client';
  return user.user_type_id;
}
