import { Injectable, Logger } from '@nestjs/common';
import * as libphonenumber from 'google-libphonenumber';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { AssistantIdentity, AssistantLocale } from './assistant.types';

interface UserIdentityRow {
  id: string;
  first_name: string | null;
  preferred_language: string | null;
  phone_number: string | null;
  user_type_id: string | null;
  client?: { id: string } | null;
  agent?: { id: string } | null;
  business?: { id: string } | null;
}

@Injectable()
export class AssistantIdentityService {
  private readonly logger = new Logger(AssistantIdentityService.name);
  private readonly phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

  constructor(private readonly hasura: HasuraSystemService) {}

  async resolveFromPhone(phone: string): Promise<AssistantIdentity> {
    const normalized = phone.replace(/^\+/, '').trim();
    const country = this.inferCountryFromPhone(normalized);
    if (!normalized) return this.anonymous(null, country);
    const user = await this.findByPhone(normalized);
    return user
      ? this.fromUser(user, normalized, country)
      : this.anonymous(normalized, country);
  }

  async resolveFromUserId(
    userId: string | null | undefined
  ): Promise<AssistantIdentity> {
    if (!userId || userId === 'anonymous') return this.anonymous();
    const user = await this.findById(userId);
    if (!user) return this.anonymous();
    const phone = user.phone_number?.replace(/^\+/, '').trim() || null;
    return this.fromUser(user, phone, this.inferCountryFromPhone(phone || ''));
  }

  anonymous(
    phoneE164: string | null = null,
    country: string | null = null
  ): AssistantIdentity {
    return {
      isVerified: false,
      userId: null,
      firstName: null,
      preferredLanguage: null,
      country,
      phoneE164,
      accountType: null,
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
    country: string | null
  ): AssistantIdentity {
    return {
      isVerified: true,
      userId: user.id,
      firstName: user.first_name?.trim() || null,
      preferredLanguage: normalizeLocale(user.preferred_language),
      country,
      phoneE164,
      accountType: resolveAccountType(user),
    };
  }
}

const USER_QUERY_PREFIX = 'query AssistantUser';
const USER_FIELDS = `
  id first_name preferred_language phone_number user_type_id
  client { id } agent { id } business { id }
`;

function normalizeLocale(value: string | null): AssistantLocale | null {
  if (value?.toLowerCase().startsWith('fr')) return 'fr';
  if (value?.toLowerCase().startsWith('en')) return 'en';
  return null;
}

function resolveAccountType(user: UserIdentityRow): string | null {
  if (user.business?.id) return 'business';
  if (user.agent?.id) return 'agent';
  if (user.client?.id) return 'client';
  return user.user_type_id;
}
