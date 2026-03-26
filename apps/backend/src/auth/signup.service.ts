import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Auth0Service } from './auth0.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

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

@Injectable()
export class SignupService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly auth0Service: Auth0Service
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

  async startSignup(payload: SignupStartPayload): Promise<{ userId: string }> {
    const email = this.normalizeEmail(payload.email);
    const taken = await this.isEmailTaken(email);
    if (taken) {
      throw new HttpException(
        { success: false, error: 'Email is already taken' },
        HttpStatus.CONFLICT
      );
    }
    const user = await this.createPendingUser({ ...payload, email });
    await this.auth0Service.startEmailOtp(email);
    return { userId: user.id };
  }

  async verifyOtp(email: string, otp: string) {
    return this.auth0Service.verifyEmailOtp(this.normalizeEmail(email), otp);
  }

  async completeSignup(userId: string, auth0User: any): Promise<{ user: any }> {
    const identifier = auth0User?.sub;
    const email = this.normalizeEmail(auth0User?.email || '');
    if (!identifier || !email) {
      throw new HttpException(
        { success: false, error: 'Invalid authenticated user' },
        HttpStatus.BAD_REQUEST
      );
    }
    const userById = await this.hasuraSystemService.executeQuery<{
      users_by_pk: { id: string; email: string; identifier: string | null } | null;
    }>(
      `
      query GetUser($id: uuid!) {
        users_by_pk(id: $id) {
          id
          email
          identifier
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
    const existingIdentifier = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(
      `
      query ExistingIdentifier($identifier: String!) {
        users(where: { identifier: { _eq: $identifier } }, limit: 1) {
          id
        }
      }
    `,
      { identifier }
    );
    if ((existingIdentifier.users?.length || 0) > 0) {
      throw new HttpException(
        { success: false, error: 'Auth0 identity already linked' },
        HttpStatus.CONFLICT
      );
    }
    const update = await this.hasuraSystemService.executeMutation<{
      update_users_by_pk: any;
    }>(
      `
      mutation CompleteSignup($id: uuid!, $identifier: String!) {
        update_users_by_pk(
          pk_columns: { id: $id }
          _set: { identifier: $identifier, email_verified: true }
        ) {
          id
          identifier
          email
          first_name
          last_name
          user_type_id
          email_verified
        }
      }
    `,
      { id: userId, identifier }
    );
    return { user: update.update_users_by_pk };
  }

  private async createPendingUser(payload: SignupStartPayload): Promise<{ id: string }> {
    const baseInput = {
      email: payload.email,
      first_name: payload.first_name,
      last_name: payload.last_name,
      phone_number: payload.phone_number || null,
      user_type_id: payload.user_type_id,
      identifier: null,
      email_verified: false,
    };
    if (payload.user_type_id === 'client') {
      const result = await this.hasuraSystemService.executeMutation<{
        insert_users_one: { id: string };
      }>(
        `
        mutation CreatePendingClient($object: users_insert_input!) {
          insert_users_one(object: $object) { id }
        }
      `,
        { object: { ...baseInput, client: { data: {} } } }
      );
      return result.insert_users_one;
    }
    if (payload.user_type_id === 'agent') {
      const result = await this.hasuraSystemService.executeMutation<{
        insert_users_one: { id: string };
      }>(
        `
        mutation CreatePendingAgent($object: users_insert_input!) {
          insert_users_one(object: $object) { id }
        }
      `,
        {
          object: {
            ...baseInput,
            agent: { data: { vehicle_type_id: payload.profile.vehicle_type_id || 'other' } },
          },
        }
      );
      return result.insert_users_one;
    }
    const mainInterest = payload.profile.main_interest || 'sell_items';
    const result = await this.hasuraSystemService.executeMutation<{
      insert_users_one: { id: string };
    }>(
      `
      mutation CreatePendingBusiness($object: users_insert_input!) {
        insert_users_one(object: $object) { id }
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
    return result.insert_users_one;
  }
}
