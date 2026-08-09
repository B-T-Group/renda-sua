import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AddressesService } from '../addresses/addresses.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  metaRegistrationEventId,
  metaUserTypeFromPersona,
} from '../meta-conversions/meta-conversions.constants';
import { MetaConversionsService } from '../meta-conversions/meta-conversions.service';
import type { MetaActionSource } from '../meta-conversions/meta-conversions.types';
import type { PersonaId } from '../users/persona.types';
import { isPersonaId } from '../users/persona.types';
import { Auth0Service } from './auth0.service';
import { BusinessProvisioningService } from './provisioning/business-provisioning.service';
import { ReferralProvisioningService } from './provisioning/referral-provisioning.service';
import { normalizeSignupAddress } from './provisioning/signup-address.normalize';
import { UserProvisioningService } from './provisioning/user-provisioning.service';

interface SignupStartPayload {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone_number?: string | null;
  /** @deprecated use `personas`; kept for backward compatibility */
  user_type_id?: 'client' | 'agent' | 'business';
  personas?: PersonaId[];
  profile: {
    vehicle_type_id?: string;
    name?: string;
    main_interest?: 'sell_items' | 'rent_items';
  };
  country?: string;
  store_location?: {
    street: string;
    city: string;
    region: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };
  /** @deprecated prefer country + store_location */
  address?: {
    address_line_1: string;
    country: string;
    city: string;
    state: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };
  referral_agent_code?: string;
  /** Optional Meta CAPI browser ids / source for CompleteRegistration. */
  fbc?: string | null;
  fbp?: string | null;
  eventSourceUrl?: string;
  actionSource?: MetaActionSource;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

interface UpdateContactPayload {
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone_number?: string | null;
}

interface PendingSignupContact {
  first_name: string;
  last_name: string;
  email: string | null;
  phone_number: string | null;
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
    private readonly userProvisioning: UserProvisioningService,
    private readonly businessProvisioning: BusinessProvisioningService,
    private readonly referralProvisioning: ReferralProvisioningService,
    private readonly metaConversionsService: MetaConversionsService
  ) {}

  normalizeEmail(email?: string | null): string {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  normalizePhone(phone?: string | null): string {
    return String(phone || '').trim();
  }

  /**
   * True when any user row already owns this email.
   *
   * Do not treat `email_verified` / `phone_number_verified` as proof of a real
   * account: Auth0 Universal Login never flips those DB flags, so "unverified
   * reclaim" would strip contacts from active users and rebind Auth0 email
   * lookup to a new pending signup.
   */
  async isEmailTaken(email: string): Promise<boolean> {
    return this.isContactTaken('email', this.normalizeEmail(email));
  }

  /**
   * True when any user row already owns this phone.
   * Same safety rule as {@link isEmailTaken}.
   */
  async isPhoneTaken(phoneNumber: string): Promise<boolean> {
    return this.isContactTaken(
      'phone_number',
      this.normalizePhone(phoneNumber)
    );
  }

  async isEmailTakenByOther(email: string, excludeId: string): Promise<boolean> {
    return this.isContactTakenByOther(
      'email',
      this.normalizeEmail(email),
      excludeId
    );
  }

  async isPhoneTakenByOther(
    phoneNumber: string,
    excludeId: string
  ): Promise<boolean> {
    return this.isContactTakenByOther(
      'phone_number',
      this.normalizePhone(phoneNumber),
      excludeId
    );
  }

  private async isContactTaken(
    field: 'email' | 'phone_number',
    value: string
  ): Promise<boolean> {
    if (!value) return false;
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(
      `
      query ContactTaken($value: String!) {
        users(where: { ${field}: { _eq: $value } }, limit: 1) { id }
      }
    `,
      { value }
    );
    return (result.users?.length || 0) > 0;
  }

  private async isContactTakenByOther(
    field: 'email' | 'phone_number',
    value: string,
    excludeId: string
  ): Promise<boolean> {
    if (!value) return false;
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(
      `
      query ContactTakenByOther($value: String!, $id: uuid!) {
        users(
          where: { ${field}: { _eq: $value }, id: { _neq: $id } }
          limit: 1
        ) { id }
      }
    `,
      { value, id: excludeId }
    );
    return (result.users?.length || 0) > 0;
  }

  async startSignup(payload: SignupStartPayload): Promise<{
    user: SignupCreatedUser;
    launchPromo: {
      status: string;
      ordersRemaining: number;
      businessLimit: number | null;
      zeroCommissionOrders: number | null;
      identificationWindowDays: number | null;
    } | null;
  }> {
    const email = this.normalizeEmail(payload.email);
    const phoneNumber = this.normalizePhone(payload.phone_number);

    if (!email && !phoneNumber) {
      throw new HttpException(
        { success: false, error: 'Email or phone number is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    if (email && (await this.isEmailTaken(email))) {
      throw new HttpException(
        { success: false, error: 'Email is already taken' },
        HttpStatus.CONFLICT
      );
    }

    if (phoneNumber && (await this.isPhoneTaken(phoneNumber))) {
      throw new HttpException(
        { success: false, error: 'Phone number is already taken' },
        HttpStatus.CONFLICT
      );
    }

    const personas = this.normalizeSignupPersonas(payload);
    if (
      payload.store_location &&
      !payload.country?.trim() &&
      !payload.address?.country?.trim()
    ) {
      throw new HttpException(
        {
          success: false,
          error: 'country is required when store_location is provided',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const normalizedAddress = normalizeSignupAddress({
      country: payload.country,
      store_location: payload.store_location,
      address: payload.address,
    });

    const businessReferral =
      await this.referralProvisioning.resolveBusinessReferral(
        personas,
        payload.referral_agent_code
      );
    const referralFields =
      this.referralProvisioning.getBusinessInsertReferralFields(businessReferral);

    const businessName =
      payload.profile?.name?.trim() || `${payload.first_name}'s Business`;

    const nestStoreAddress =
      personas.includes('business') &&
      normalizedAddress &&
      !normalizedAddress.countryOnly
        ? normalizedAddress
        : undefined;

    const { user, entities, businessLocation } =
      await this.userProvisioning.createPendingUser({
        email: email || null,
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone_number: phoneNumber || null,
        email_verified: false,
        personas,
        vehicle_type_id: payload.profile?.vehicle_type_id,
        business_name: businessName,
        main_interest: payload.profile?.main_interest ?? 'sell_items',
        ...referralFields,
        storeAddress: nestStoreAddress,
      });

    // Seed addresses for personas that were not covered by the nested business insert.
    // When businessLocation exists, skip the business entity (already nested) but still
    // link client/agent addresses from the same store/country address.
    if (normalizedAddress) {
      await this.seedLegacyAddresses(
        user.id,
        entities,
        normalizedAddress,
        Boolean(businessLocation)
      );
    }

    const { launchPromo } = await this.businessProvisioning.runPostCommitEffects({
      userId: user.id,
      entities,
      businessLocation,
      storeAddress: nestStoreAddress ?? normalizedAddress,
      phoneNumber: phoneNumber || payload.phone_number,
      businessName,
      countryCode: normalizedAddress?.country,
    });

    await this.referralProvisioning.runPostCommitEffects({
      entities,
      referral: businessReferral,
      referralAgentCode: payload.referral_agent_code,
      country: normalizedAddress?.country,
      businessName,
      ownerName: `${payload.first_name} ${payload.last_name}`.trim(),
    });

    this.emitCompleteRegistration(user, payload);

    return {
      user,
      launchPromo: launchPromo
        ? {
            status: launchPromo.status,
            ordersRemaining: launchPromo.ordersRemaining,
            businessLimit: launchPromo.businessLimit,
            zeroCommissionOrders: launchPromo.zeroCommissionOrders,
            identificationWindowDays: launchPromo.identificationWindowDays,
          }
        : null,
    };
  }

  private emitCompleteRegistration(
    user: SignupCreatedUser,
    payload: SignupStartPayload
  ): void {
    void this.metaConversionsService.trackCompleteRegistrationSafe({
      eventId: metaRegistrationEventId(user.id),
      actionSource: payload.actionSource ?? 'website',
      userType: metaUserTypeFromPersona(user.user_type_id),
      externalId: user.id,
      email: user.email,
      phone: user.phone_number,
      firstName: user.first_name,
      lastName: user.last_name,
      clientIpAddress: payload.clientIpAddress,
      clientUserAgent: payload.clientUserAgent,
      fbc: payload.fbc,
      fbp: payload.fbp,
      eventSourceUrl: payload.eventSourceUrl,
    });
  }

  private async seedLegacyAddresses(
    userId: string,
    entities: Array<{ id: string; type: PersonaId }>,
    address: NonNullable<ReturnType<typeof normalizeSignupAddress>>,
    businessLocationAlreadyCreated = false
  ): Promise<void> {
    for (const entity of entities) {
      if (entity.type === 'business') {
        // Nested insert already created business location + address.
        if (businessLocationAlreadyCreated) continue;
        // Country-only address is not enough for a business location.
        if (address.countryOnly) continue;
      }
      await this.addressesService.createAddressForSignup(
        userId,
        entity.id,
        entity.type,
        {
          address_line_1: address.address_line_1,
          country: address.country,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          latitude: address.latitude,
          longitude: address.longitude,
        }
      );
    }
  }

  async updateContact(body: UpdateContactPayload): Promise<{ user: SignupCreatedUser }> {
    const userId = String(body.user_id || '').trim();
    this.assertUpdateContactUserId(userId);

    const existing = await this.loadUnverifiedUser(userId);
    const hasEmailUpdate = this.hasPayloadField(body, 'email');
    const hasPhoneUpdate = this.hasPayloadField(body, 'phone_number');
    const email = hasEmailUpdate ? this.normalizeEmail(body.email) : '';
    const phoneNumber = hasPhoneUpdate ? this.normalizePhone(body.phone_number) : '';
    this.assertContactUpdateHasValue(email, phoneNumber);
    await this.assertContactAvailable(email, phoneNumber, userId);

    const nextEmail = hasEmailUpdate ? email || null : existing.email;
    const nextPhone = hasPhoneUpdate
      ? phoneNumber || null
      : existing.phone_number;

    return this.runUpdateContact(userId, {
      email: nextEmail,
      phone_number: nextPhone,
      first_name: body.first_name?.trim() || existing.first_name,
      last_name: body.last_name?.trim() || existing.last_name,
    });
  }

  private assertUpdateContactUserId(userId: string): void {
    if (!userId) {
      throw new HttpException(
        { success: false, error: 'user_id is required' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private hasPayloadField(
    body: UpdateContactPayload,
    key: 'email' | 'phone_number'
  ): boolean {
    return Object.prototype.hasOwnProperty.call(body, key);
  }

  private assertContactUpdateHasValue(email: string, phoneNumber: string): void {
    if (!email && !phoneNumber) {
      throw new HttpException(
        { success: false, error: 'Email or phone number is required' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async loadUnverifiedUser(userId: string): Promise<PendingSignupContact> {
    const result = await this.hasuraSystemService.executeQuery<{
      users_by_pk: {
        first_name: string;
        last_name: string;
        email: string | null;
        phone_number: string | null;
        email_verified: boolean;
        phone_number_verified: boolean;
      } | null;
    }>(
      `
      query GetSignupUser($id: uuid!) {
        users_by_pk(id: $id) {
          first_name
          last_name
          email
          phone_number
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
    return {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number,
    };
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
    userId?: string;
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
    const tokenData = email
      ? await this.resolveEmailVerification(email, body.otp)
      : await this.resolvePhoneVerification(phone, body.otp);
    await this.scheduleContractAfterOtp(body.userId, email, phone);
    return tokenData;
  }

  private async scheduleContractAfterOtp(
    userId: string | undefined,
    email: string,
    phone: string
  ): Promise<void> {
    const resolvedId =
      userId?.trim() ||
      (email ? await this.findUserIdByEmail(email) : null) ||
      (phone ? await this.findUserIdByPhone(phone) : null);
    if (resolvedId) {
      await this.businessProvisioning.scheduleEnsureContractForUser(resolvedId);
    }
  }

  private async findUserIdByEmail(email: string): Promise<string | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(
      `
      query SignupUserByEmail($email: String!) {
        users(where: { email: { _eq: $email } }, limit: 1) { id }
      }
    `,
      { email }
    );
    return result.users?.[0]?.id ?? null;
  }

  private async findUserIdByPhone(phone: string): Promise<string | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(
      `
      query SignupUserByPhone($phone: String!) {
        users(where: { phone_number: { _eq: $phone } }, limit: 1) { id }
      }
    `,
      { phone }
    );
    return result.users?.[0]?.id ?? null;
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
    const user = update.update_users_by_pk;
    if (user?.id) {
      await this.businessProvisioning.scheduleEnsureContractForUser(user.id);
    }
    return { user };
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
}
