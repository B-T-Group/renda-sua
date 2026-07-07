import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AddressesService } from '../addresses/addresses.service';
import { BusinessReferralsService, ResolvedBusinessReferral } from '../business-referrals/business-referrals.service';
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
  email?: string | null;
  phone_number?: string | null;
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
  referral_agent_code?: string;
}

interface UpdateContactPayload {
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone_number?: string | null;
}

export interface SignupCreatedUser {
  id: string;
  email: string | null;
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
    private readonly addressesService: AddressesService,
    private readonly businessReferralsService: BusinessReferralsService
  ) {}

  normalizeEmail(email?: string | null): string {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  normalizePhone(phone?: string | null): string {
    return String(phone || '').trim();
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

  async isPhoneTaken(phoneNumber: string): Promise<boolean> {
    const phone = this.normalizePhone(phoneNumber);
    const query = `
      query PhoneTaken($phone: String!) {
        users(where: { phone_number: { _eq: $phone } }, limit: 1) {
          id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(query, { phone });
    return (result.users?.length || 0) > 0;
  }

  async isEmailTakenByOther(email: string, excludeId: string): Promise<boolean> {
    const normalized = this.normalizeEmail(email);
    const query = `
      query EmailTakenByOther($email: String!, $id: uuid!) {
        users(where: { email: { _eq: $email }, id: { _neq: $id } }, limit: 1) {
          id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(query, { email: normalized, id: excludeId });
    return (result.users?.length || 0) > 0;
  }

  async isPhoneTakenByOther(phoneNumber: string, excludeId: string): Promise<boolean> {
    const phone = this.normalizePhone(phoneNumber);
    const query = `
      query PhoneTakenByOther($phone: String!, $id: uuid!) {
        users(where: { phone_number: { _eq: $phone }, id: { _neq: $id } }, limit: 1) {
          id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(query, { phone, id: excludeId });
    return (result.users?.length || 0) > 0;
  }

  async startSignup(payload: SignupStartPayload): Promise<{ user: SignupCreatedUser }> {
    const email = this.normalizeEmail(payload.email);
    const phoneNumber = this.normalizePhone(payload.phone_number);

    if (!email && !phoneNumber) {
      throw new HttpException(
        { success: false, error: 'Email or phone number is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    if (email) {
      const emailTaken = await this.isEmailTaken(email);
      if (emailTaken) {
        throw new HttpException(
          { success: false, error: 'Email is already taken' },
          HttpStatus.CONFLICT
        );
      }
    }

    if (phoneNumber) {
      const phoneTaken = await this.isPhoneTaken(phoneNumber);
      if (phoneTaken) {
        throw new HttpException(
          { success: false, error: 'Phone number is already taken' },
          HttpStatus.CONFLICT
        );
      }
    }

    const personas = this.normalizeSignupPersonas({
      ...payload,
      email: email || null,
      phone_number: phoneNumber || null,
    });
    let businessReferral: ResolvedBusinessReferral | null = null;
    if (personas.includes('business')) {
      businessReferral =
        await this.businessReferralsService.resolveBusinessReferralCode(
          payload.referral_agent_code
        );
    }

    const { user, entities } = await this.createPendingUser(
      {
        ...payload,
        email: email || null,
        phone_number: phoneNumber || null,
      },
      businessReferral
    );
    if (payload.address && entities.length > 0) {
      const uid = user.id;
      for (const entity of entities) {
        await this.addressesService.createAddressForSignup(
          uid,
          entity.id,
          entity.type,
          payload.address
        );
      }
    }

    const businessEntity = entities.find((e) => e.type === 'business');
    if (businessEntity && businessReferral) {
      const businessName =
        payload.profile?.name?.trim() ||
        `${payload.first_name}'s Business`;
      await this.businessReferralsService.notifyAgentOfBusinessReferral(
        {
          businessId: businessEntity.id,
          countryCode: payload.address?.country,
          businessName,
          businessOwnerName: `${payload.first_name} ${payload.last_name}`.trim(),
        },
        businessReferral
      );
    }

    return { user };
  }

  async updateContact(body: UpdateContactPayload): Promise<{ user: SignupCreatedUser }> {
    const userId = String(body.user_id || '').trim();
    if (!userId) {
      throw new HttpException(
        { success: false, error: 'user_id is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const email = this.normalizeEmail(body.email);
    const phoneNumber = this.normalizePhone(body.phone_number);
    if (!email && !phoneNumber) {
      throw new HttpException(
        { success: false, error: 'Email or phone number is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const existing = await this.loadUnverifiedUser(userId);
    await this.assertContactAvailable(email, phoneNumber, userId);
    return this.runUpdateContact(userId, {
      email: email || null,
      phone_number: phoneNumber || null,
      first_name: body.first_name?.trim() || existing.first_name,
      last_name: body.last_name?.trim() || existing.last_name,
    });
  }

  private async loadUnverifiedUser(userId: string): Promise<{
    first_name: string;
    last_name: string;
  }> {
    const result = await this.hasuraSystemService.executeQuery<{
      users_by_pk: {
        first_name: string;
        last_name: string;
        email_verified: boolean;
        phone_number_verified: boolean;
      } | null;
    }>(
      `
      query GetSignupUser($id: uuid!) {
        users_by_pk(id: $id) {
          first_name
          last_name
          email_verified
          phone_number_verified
        }
      }
    `,
      { id: userId }
    );
    const user = result.users_by_pk;
    if (!user) {
      throw new HttpException(
        { success: false, error: 'Signup user not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (user.email_verified || user.phone_number_verified) {
      throw new HttpException(
        { success: false, error: 'Account already verified' },
        HttpStatus.CONFLICT
      );
    }
    return { first_name: user.first_name, last_name: user.last_name };
  }

  private async assertContactAvailable(
    email: string,
    phoneNumber: string,
    excludeId: string
  ): Promise<void> {
    if (email && (await this.isEmailTakenByOther(email, excludeId))) {
      throw new HttpException(
        { success: false, error: 'Email is already taken' },
        HttpStatus.CONFLICT
      );
    }
    if (phoneNumber && (await this.isPhoneTakenByOther(phoneNumber, excludeId))) {
      throw new HttpException(
        { success: false, error: 'Phone number is already taken' },
        HttpStatus.CONFLICT
      );
    }
  }

  private async runUpdateContact(
    userId: string,
    set: {
      email: string | null;
      phone_number: string | null;
      first_name: string;
      last_name: string;
    }
  ): Promise<{ user: SignupCreatedUser }> {
    const result = await this.hasuraSystemService.executeMutation<{
      update_users_by_pk: SignupCreatedUser | null;
    }>(
      `
      mutation UpdateSignupContact(
        $id: uuid!
        $email: String
        $phone_number: String
        $first_name: String!
        $last_name: String!
      ) {
        update_users_by_pk(
          pk_columns: { id: $id }
          _set: {
            email: $email
            phone_number: $phone_number
            first_name: $first_name
            last_name: $last_name
            email_verified: false
            phone_number_verified: false
          }
        ) {
          id
          email
          first_name
          last_name
          user_type_id
          phone_number
          email_verified
        }
      }
    `,
      { id: userId, ...set }
    );
    if (!result.update_users_by_pk) {
      throw new HttpException(
        { success: false, error: 'Failed to update contact' },
        HttpStatus.NOT_FOUND
      );
    }
    return { user: result.update_users_by_pk };
  }

  async verifyOtp(body: {
    email?: string;
    phone_number?: string;
    otp: string;
  }) {
    const email = body.email?.trim() ? this.normalizeEmail(body.email) : '';
    const phone = body.phone_number?.trim()
      ? this.normalizePhone(body.phone_number)
      : '';
    if ((email && phone) || (!email && !phone)) {
      throw new HttpException(
        {
          success: false,
          error: 'Provide exactly one of email or phone_number with otp',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    if (email) {
      return this.resolveEmailVerification(email, body.otp);
    }
    return this.resolvePhoneVerification(phone, body.otp);
  }

  private isTestUser(identifier: string, isPhone: boolean): boolean {
    if (!this.auth0Service.isTestUsersEnabled()) return false;
    return isPhone
      ? this.auth0Service.isTestPhone(identifier)
      : this.auth0Service.isTestEmail(identifier);
  }

  private resolveEmailVerification(email: string, otp: string) {
    if (this.isTestUser(email, false)) {
      return this.auth0Service.verifyTestUserEmail(email);
    }
    return this.auth0Service.verifyEmailOtp(email, otp);
  }

  private resolvePhoneVerification(phone: string, otp: string) {
    if (this.isTestUser(phone, true)) {
      return this.auth0Service.verifyTestUserPhone(phone);
    }
    return this.auth0Service.verifySmsOtp(phone, otp);
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
      users_by_pk: { id: string; email: string | null } | null;
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
    const pendingStored = this.normalizeEmail(pendingUser.email);
    if (pendingStored && pendingStored !== email) {
      throw new HttpException(
        { success: false, error: 'Email mismatch for signup completion' },
        HttpStatus.CONFLICT
      );
    }
    const update = await this.hasuraSystemService.executeMutation<{
      update_users_by_pk: any;
    }>(
      `
      mutation CompleteSignup($id: uuid!, $email: String!) {
        update_users_by_pk(
          pk_columns: { id: $id }
          _set: { email: $email, email_verified: true }
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
      { id: userId, email }
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
    payload: SignupStartPayload,
    businessReferral: ResolvedBusinessReferral | null = null
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
      ...this.businessReferralsService.getBusinessInsertReferralFields(
        businessReferral
      ),
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
