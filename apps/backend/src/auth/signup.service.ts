import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AddressesService } from '../addresses/addresses.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
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
  user_type_id: 'client' | 'agent' | 'business';
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

type InsertUserWithProfiles = SignupCreatedUser & {
  client?: { id: string } | null;
  agent?: { id: string } | null;
  business?: { id: string } | null;
};

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
    const { user, entity } = await this.createPendingUser({ ...payload, email });
    if (payload.address && entity) {
      await this.addressesService.createAddressForSignup(
        entity.id,
        entity.type,
        payload.address
      );
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

  private mapInsertRow(row: InsertUserWithProfiles): {
    user: SignupCreatedUser;
    entity: { id: string; type: 'client' | 'agent' | 'business' } | null;
  } {
    const user: SignupCreatedUser = {
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      user_type_id: row.user_type_id,
      phone_number: row.phone_number,
      email_verified: row.email_verified,
    };
    if (row.client?.id) {
      return { user, entity: { id: row.client.id, type: 'client' } };
    }
    if (row.agent?.id) {
      return { user, entity: { id: row.agent.id, type: 'agent' } };
    }
    if (row.business?.id) {
      return { user, entity: { id: row.business.id, type: 'business' } };
    }
    return { user, entity: null };
  }

  private async createPendingUser(
    payload: SignupStartPayload
  ): Promise<{
    user: SignupCreatedUser;
    entity: { id: string; type: 'client' | 'agent' | 'business' } | null;
  }> {
    const baseInput = {
      email: payload.email,
      first_name: payload.first_name,
      last_name: payload.last_name,
      phone_number: payload.phone_number || null,
      user_type_id: payload.user_type_id,
      email_verified: false,
    };
    const userFields = `
      id
      email
      first_name
      last_name
      user_type_id
      phone_number
      email_verified
      client { id }
      agent { id }
      business { id }
    `;
    if (payload.user_type_id === 'client') {
      const result = await this.hasuraSystemService.executeMutation<{
        insert_users_one: InsertUserWithProfiles;
      }>(
        `
        mutation CreatePendingClient($object: users_insert_input!) {
          insert_users_one(object: $object) { ${userFields} }
        }
      `,
        { object: { ...baseInput, client: { data: {} } } }
      );
      return this.mapInsertRow(result.insert_users_one);
    }
    if (payload.user_type_id === 'agent') {
      const result = await this.hasuraSystemService.executeMutation<{
        insert_users_one: InsertUserWithProfiles;
      }>(
        `
        mutation CreatePendingAgent($object: users_insert_input!) {
          insert_users_one(object: $object) { ${userFields} }
        }
      `,
        {
          object: {
            ...baseInput,
            agent: { data: { vehicle_type_id: payload.profile.vehicle_type_id || 'other' } },
          },
        }
      );
      return this.mapInsertRow(result.insert_users_one);
    }
    const mainInterest = payload.profile.main_interest || 'sell_items';
    const result = await this.hasuraSystemService.executeMutation<{
      insert_users_one: InsertUserWithProfiles;
    }>(
      `
      mutation CreatePendingBusiness($object: users_insert_input!) {
        insert_users_one(object: $object) { ${userFields} }
      }
    `,
      {
        object: {
          ...baseInput,
          business: {
            data: {
              name: payload.profile.name || `${payload.first_name}'s Business`,
              main_interest: mainInterest,
            },
          },
        },
      }
    );
    return this.mapInsertRow(result.insert_users_one);
  }
}
