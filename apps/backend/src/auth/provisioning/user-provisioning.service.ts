import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import type { PersonaId } from '../../users/persona.types';
import { legacyUserTypeIdForPersonas } from '../../users/persona.util';
import {
  buildPersonaFragments,
  type PersonaInsertContext,
} from './persona-provisioners';
import type { NormalizedSignupAddress } from './signup-address.normalize';

export interface ProvisionedUser {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  user_type_id: string;
  phone_number: string | null;
  email_verified: boolean;
}

export interface ProvisionedEntity {
  id: string;
  type: PersonaId;
}

export interface ProvisionedBusinessLocation {
  id: string;
  addressId: string;
  country: string;
  city: string;
}

export interface UserProvisioningResult {
  user: ProvisionedUser;
  entities: ProvisionedEntity[];
  businessLocation?: ProvisionedBusinessLocation;
}

export interface UserProvisioningInput {
  email?: string | null;
  first_name: string;
  last_name: string;
  phone_number?: string | null;
  email_verified?: boolean;
  personas: PersonaId[];
  vehicle_type_id?: string;
  business_name?: string;
  main_interest?: 'sell_items' | 'rent_items';
  business_referral_agent_id?: string;
  business_referral_code_used?: string;
  storeAddress?: NormalizedSignupAddress;
}

@Injectable()
export class UserProvisioningService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async createPendingUser(
    input: UserProvisioningInput
  ): Promise<UserProvisioningResult> {
    const ctx: PersonaInsertContext = {
      personas: input.personas,
      vehicle_type_id: input.vehicle_type_id,
      business_name: input.business_name,
      main_interest: input.main_interest,
      business_referral_agent_id: input.business_referral_agent_id,
      business_referral_code_used: input.business_referral_code_used,
      storeAddress: input.storeAddress,
    };
    const fragments = buildPersonaFragments(ctx);
    const { mutation, variables } = this.buildInsertMutation(input, fragments);
    const result = await this.hasuraSystemService.executeMutation(
      mutation,
      variables
    );
    const u = result.insert_users_one;
    const user: ProvisionedUser = {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      user_type_id: u.user_type_id,
      phone_number: u.phone_number ?? null,
      email_verified: u.email_verified,
    };
    const entities = this.entitiesFromInsert(u);
    const businessLocation = this.extractBusinessLocation(u);
    return { user, entities, businessLocation };
  }

  private buildInsertMutation(
    input: UserProvisioningInput,
    fragments: ReturnType<typeof buildPersonaFragments>
  ): { mutation: string; variables: Record<string, unknown> } {
    const varDecls: string[] = [
      '$email: String',
      '$first_name: String!',
      '$last_name: String!',
      '$phone_number: String',
      '$email_verified: Boolean!',
      '$user_type_id: user_types_enum!',
    ];
    const vars: Record<string, unknown> = {
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      phone_number: input.phone_number ?? null,
      email_verified: input.email_verified ?? false,
      user_type_id: legacyUserTypeIdForPersonas(input.personas),
    };
    const objectFields = [
      'email: $email',
      'first_name: $first_name',
      'last_name: $last_name',
      'phone_number: $phone_number',
      'email_verified: $email_verified',
      'user_type_id: $user_type_id',
    ];
    const returnSel = [
      'id',
      'email',
      'first_name',
      'last_name',
      'phone_number',
      'phone_number_verified',
      'email_verified',
      'user_type_id',
      'created_at',
      'updated_at',
    ];

    for (const frag of fragments) {
      varDecls.push(...frag.varDecls);
      Object.assign(vars, frag.vars);
      objectFields.push(frag.objectField);
      returnSel.push(frag.returnSel);
    }

    const mutation = `
      mutation InsertUserMulti(${varDecls.join(', ')}) {
        insert_users_one(object: {
          ${objectFields.join('\n          ')}
        }) {
          ${returnSel.join('\n          ')}
        }
      }
    `;
    return { mutation, variables: vars };
  }

  private entitiesFromInsert(row: {
    client?: { id: string } | null;
    agent?: { id: string } | null;
    business?: { id: string } | null;
  }): ProvisionedEntity[] {
    const out: ProvisionedEntity[] = [];
    if (row.client?.id) out.push({ id: row.client.id, type: 'client' });
    if (row.agent?.id) out.push({ id: row.agent.id, type: 'agent' });
    if (row.business?.id) out.push({ id: row.business.id, type: 'business' });
    return out;
  }

  private extractBusinessLocation(row: {
    business?: {
      business_locations?: Array<{
        id: string;
        address_id: string;
        address?: { id: string; country: string; city: string };
      }>;
    } | null;
  }): ProvisionedBusinessLocation | undefined {
    const loc = row.business?.business_locations?.[0];
    if (!loc?.id || !loc.address_id) return undefined;
    return {
      id: loc.id,
      addressId: loc.address_id,
      country: loc.address?.country ?? '',
      city: loc.address?.city ?? '',
    };
  }
}
