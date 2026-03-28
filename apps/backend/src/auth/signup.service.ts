import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AddressesService } from '../addresses/addresses.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { PersonaId } from '../users/persona.types';
import { isPersonaId } from '../users/persona.types';
import { Auth0Service } from './auth0.service';

type SignupGoalId =
  | 'browse_buy'
  | 'delivery_agent'
  | 'sell_items'
  | 'rent_and_earn';

interface SignupStartPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  /** @deprecated use `personas`; kept for backward compatibility */
  user_type_id?: 'client' | 'agent' | 'business';
  /** When set (1–3 values), creates all selected profiles in one user row */
  personas?: PersonaId[];
  signup_goal?: SignupGoalId;
  profile: {
    vehicle_type_id?: string;
    name?: string;
    main_interest?: 'sell_items' | 'rent_items';
  };
  address?: {
    address_line_1: string;
    country: string;
    city: string;
    state: string;
  };
}

export interface SignupCreatedUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type_id: string;
  phone_number: string | null;
  email_verified: boolean;
}

@Injectable()
export class SignupService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly auth0Service: Auth0Service,
    private readonly addressesService: AddressesService
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async isEmailTaken(email: string): Promise<boolean> {
    const normalized = this.normalizeEmail(email);
    const query = `
      query EmailTaken($email: String!) {
        users(where: { email: { _eq: $email } }, limit: 1) {
          id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(query, { email: normalized });
    return (result.users?.length || 0) > 0;
  }

  async startSignup(payload: SignupStartPayload): Promise<{ user: SignupCreatedUser }> {
    const email = this.normalizeEmail(payload.email);
    const taken = await this.isEmailTaken(email);
    if (taken) {
      throw new HttpException(
        { success: false, error: 'Email is already taken' },
        HttpStatus.CONFLICT
      );
    }
    const { user, entities } = await this.createPendingUser({ ...payload, email });
    if (payload.address && entities.length > 0) {
      for (const entity of entities) {
        await this.addressesService.createAddressForSignup(
          entity.id,
          entity.type,
          payload.address
        );
      }
    }
    return { user };
  }

  async verifyOtp(email: string, otp: string) {
    return this.auth0Service.verifyEmailOtp(this.normalizeEmail(email), otp);
  }

  async completeSignup(userId: string, auth0User: any): Promise<{ user: any }> {
    const email = this.normalizeEmail(auth0User?.email || '');
    if (!email) {
      throw new HttpException(
        { success: false, error: 'Invalid authenticated user' },
        HttpStatus.BAD_REQUEST
      );
    }
    const userById = await this.hasuraSystemService.executeQuery<{
      users_by_pk: { id: string; email: string } | null;
    }>(
      `
      query GetUser($id: uuid!) {
        users_by_pk(id: $id) {
          id
          email
        }
      }
    `,
      { id: userId }
    );
    const pendingUser = userById.users_by_pk;
    if (!pendingUser) {
      throw new HttpException(
        { success: false, error: 'Signup user not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (this.normalizeEmail(pendingUser.email) !== email) {
      throw new HttpException(
        { success: false, error: 'Email mismatch for signup completion' },
        HttpStatus.CONFLICT
      );
    }
    const update = await this.hasuraSystemService.executeMutation<{
      update_users_by_pk: any;
    }>(
      `
      mutation CompleteSignup($id: uuid!) {
        update_users_by_pk(
          pk_columns: { id: $id }
          _set: { email_verified: true }
        ) {
          id
          email
          first_name
          last_name
          user_type_id
          email_verified
        }
      }
    `,
      { id: userId }
    );
    return { user: update.update_users_by_pk };
  }

  private normalizeSignupPersonas(payload: SignupStartPayload): PersonaId[] {
    if (payload.personas?.length) {
      const unique = [...new Set(payload.personas)];
      if (!unique.every(isPersonaId)) {
        throw new HttpException(
          { success: false, error: 'Invalid personas' },
          HttpStatus.BAD_REQUEST
        );
      }
      return unique;
    }
    if (payload.user_type_id && isPersonaId(payload.user_type_id)) {
      return [payload.user_type_id];
    }
    throw new HttpException(
      { success: false, error: 'personas or user_type_id is required' },
      HttpStatus.BAD_REQUEST
    );
  }

  private entitiesFromInsert(row: {
    client?: { id: string } | null;
    agent?: { id: string } | null;
    business?: { id: string } | null;
  }): Array<{ id: string; type: PersonaId }> {
    const out: Array<{ id: string; type: PersonaId }> = [];
    if (row.client?.id) out.push({ id: row.client.id, type: 'client' });
    if (row.agent?.id) out.push({ id: row.agent.id, type: 'agent' });
    if (row.business?.id) out.push({ id: row.business.id, type: 'business' });
    return out;
  }

  private async createPendingUser(
    payload: SignupStartPayload
  ): Promise<{
    user: SignupCreatedUser;
    entities: Array<{ id: string; type: PersonaId }>;
  }> {
    const personas = this.normalizeSignupPersonas(payload);
    const businessName =
      payload.profile?.name?.trim() ||
      `${payload.first_name}'s Business`;
    const inserted = await this.hasuraSystemService.insertUserWithPersonas({
      email: payload.email,
      first_name: payload.first_name,
      last_name: payload.last_name,
      phone_number: payload.phone_number ?? null,
      email_verified: false,
      personas,
      vehicle_type_id: payload.profile?.vehicle_type_id,
      business_name: businessName,
      main_interest: payload.profile?.main_interest ?? 'sell_items',
    });
    const u = inserted.user;
    const user: SignupCreatedUser = {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      user_type_id: u.user_type_id,
      phone_number: u.phone_number ?? null,
      email_verified: u.email_verified,
    };
    const entities = this.entitiesFromInsert({
      client: inserted.client,
      agent: inserted.agent,
      business: inserted.business,
    });
    return { user, entities };
  }
}
