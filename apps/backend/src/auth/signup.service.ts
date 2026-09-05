import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
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
import { Auth0Service, type Auth0TokenResponse } from './auth0.service';
import { BusinessProvisioningService } from './provisioning/business-provisioning.service';
import { ReferralProvisioningService } from './provisioning/referral-provisioning.service';
import { normalizeSignupAddress } from './provisioning/signup-address.normalize';
import { UserProvisioningService } from './provisioning/user-provisioning.service';
import { SignupAttemptStore } from './signup-attempt.store';
import {
  SIGNUP_MAX_VERIFY_ATTEMPTS,
  SIGNUP_OTP_RESEND_COOLDOWN_MS,
  type SignupAttemptChannel,
  type SignupAttemptPayload,
  type SignupAttemptRow,
  type SignupCompletionResult,
  type SignupCreatedUser,
  type SignupLaunchPromoResult,
  type SignupStartAttemptResult,
} from './signup-attempt.types';
import { isAfricanMarketCountry } from './signup-market.util';

interface SignupStartPayload {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone_number?: string | null;
  user_type_id?: 'client' | 'agent' | 'business';
  personas?: PersonaId[];
  profile: SignupAttemptPayload['profile'];
  country?: string;
  store_location?: SignupAttemptPayload['store_location'];
  address?: SignupAttemptPayload['address'];
  referral_agent_code?: string;
  fbc?: string | null;
  fbp?: string | null;
  eventSourceUrl?: string;
  actionSource?: MetaActionSource;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

interface Auth0IdTokenClaims {
  sub?: string;
  email?: string;
  phone_number?: string;
}

export type { SignupCreatedUser, SignupStartAttemptResult };

@Injectable()
export class SignupService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly auth0Service: Auth0Service,
    private readonly addressesService: AddressesService,
    private readonly userProvisioning: UserProvisioningService,
    private readonly businessProvisioning: BusinessProvisioningService,
    private readonly referralProvisioning: ReferralProvisioningService,
    private readonly metaConversionsService: MetaConversionsService,
    private readonly attemptStore: SignupAttemptStore
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
    return this.isContactTaken('email', this.normalizeEmail(email));
  }

  async isPhoneTaken(phoneNumber: string): Promise<boolean> {
    return this.isContactTaken(
      'phone_number',
      this.normalizePhone(phoneNumber)
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

  /**
   * Validate signup input, create a short-lived attempt, and send OTP.
   * Does not create a users row.
   */
  async startSignup(
    payload: SignupStartPayload
  ): Promise<SignupStartAttemptResult> {
    const prepared = await this.prepareSignupAttempt(payload);
    await this.attemptStore.supersedePendingForContact(prepared.contactValue);
    const attempt = await this.attemptStore.insertPending({
      channel: prepared.channel,
      contactValue: prepared.contactValue,
      payload: prepared.attemptPayload,
    });
    await this.sendAttemptOtp(attempt);
    return this.toStartResult(attempt);
  }

  async resendSignupOtp(attemptId: string): Promise<SignupStartAttemptResult> {
    const attempt = await this.requireActiveAttempt(attemptId);
    this.assertResendAllowed(attempt);
    await this.sendAttemptOtp(attempt);
    const refreshed = await this.attemptStore.markOtpSent(attempt.id);
    return this.toStartResult(refreshed || attempt);
  }

  /**
   * Verify OTP for an attempt, then provision the durable user + side effects.
   */
  async verifySignupOtp(body: {
    attemptId: string;
    otp: string;
  }): Promise<SignupCompletionResult> {
    const otp = String(body.otp || '').trim();
    if (!otp) {
      throw new HttpException(
        { success: false, error: 'OTP is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const existing = await this.requireAttempt(body.attemptId);
    if (existing.status === 'completed' && existing.completion_result) {
      return existing.completion_result;
    }
    this.assertAttemptVerifiable(existing);
    const claimed = await this.attemptStore.claimForVerify(existing.id);
    if (!claimed) {
      const latest = await this.requireAttempt(existing.id);
      if (latest.status === 'completed' && latest.completion_result) {
        return latest.completion_result;
      }
      throw new HttpException(
        { success: false, error: 'Signup attempt is busy. Please retry.' },
        HttpStatus.CONFLICT
      );
    }
    return this.verifyAndProvision(claimed, otp);
  }

  private async verifyAndProvision(
    attempt: SignupAttemptRow,
    otp: string
  ): Promise<SignupCompletionResult> {
    const count = await this.attemptStore.bumpVerifyCount(attempt.id);
    if (count > SIGNUP_MAX_VERIFY_ATTEMPTS) {
      await this.attemptStore.updateStatus(attempt.id, 'failed');
      throw new HttpException(
        { success: false, error: 'Too many verification attempts' },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    const tokens = await this.exchangeOtpForTokens(attempt, otp);
    await this.attemptStore.updateStatus(attempt.id, 'verifying', {
      auth0VerifiedAt: new Date().toISOString(),
    });
    try {
      const completion = await this.provisionFromAttempt(attempt, tokens);
      await this.attemptStore.updateStatus(attempt.id, 'completed', {
        completedUserId: completion.user.id,
        completionResult: completion,
      });
      return completion;
    } catch (error: any) {
      await this.attemptStore.updateStatus(
        attempt.id,
        'verified_pending_provision'
      );
      throw error;
    }
  }

  private async exchangeOtpForTokens(
    attempt: SignupAttemptRow,
    otp: string
  ): Promise<Auth0TokenResponse> {
    const isPhone = attempt.channel === 'phone';
    const tokens = await (this.isTestUser(attempt.contact_value, isPhone)
      ? isPhone
        ? this.auth0Service.verifyTestUserPhone(attempt.contact_value)
        : this.auth0Service.verifyTestUserEmail(attempt.contact_value)
      : isPhone
        ? this.auth0Service.verifySmsOtp(attempt.contact_value, otp)
        : this.auth0Service.verifyEmailOtp(attempt.contact_value, otp));
    this.assertTokenMatchesAttempt(attempt, tokens);
    return tokens;
  }

  private assertTokenMatchesAttempt(
    attempt: SignupAttemptRow,
    tokens: Auth0TokenResponse
  ): void {
    if (!tokens?.id_token) {
      throw new HttpException(
        { success: false, error: 'Auth0 did not return an id_token' },
        HttpStatus.BAD_GATEWAY
      );
    }
    const claims = jwt.decode(tokens.id_token) as Auth0IdTokenClaims | null;
    if (!claims?.sub) {
      throw new HttpException(
        { success: false, error: 'Invalid id_token returned by Auth0' },
        HttpStatus.BAD_GATEWAY
      );
    }
    if (attempt.channel === 'email') {
      const email = this.normalizeEmail(claims.email);
      if (email && email !== attempt.contact_value) {
        throw new HttpException(
          { success: false, error: 'Verified identity does not match signup' },
          HttpStatus.CONFLICT
        );
      }
      return;
    }
    const phone = this.normalizePhone(claims.phone_number);
    if (phone && phone !== attempt.contact_value) {
      throw new HttpException(
        { success: false, error: 'Verified identity does not match signup' },
        HttpStatus.CONFLICT
      );
    }
  }

  private async provisionFromAttempt(
    attempt: SignupAttemptRow,
    tokens: Auth0TokenResponse
  ): Promise<SignupCompletionResult> {
    const payload = attempt.payload;
    await this.assertContactsStillAvailable(payload);
    const personas = payload.personas;
    const normalizedAddress = normalizeSignupAddress({
      country: payload.country,
      store_location: payload.store_location,
      address: payload.address,
    });
    const signupReferral =
      await this.referralProvisioning.resolveSignupReferral(
        personas,
        payload.referral_agent_code
      );
    const businessName =
      payload.profile?.name?.trim() || `${payload.first_name}'s Business`;
    const nestStoreAddress =
      personas.includes('business') &&
      normalizedAddress &&
      !normalizedAddress.countryOnly
        ? normalizedAddress
        : undefined;
    const emailVerified = attempt.channel === 'email';
    const phoneVerified = attempt.channel === 'phone';
    const { user, entities, businessLocation } =
      await this.userProvisioning.createPendingUser({
        email: payload.email,
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone_number: payload.phone_number,
        email_verified: emailVerified,
        phone_number_verified: phoneVerified,
        country: normalizedAddress?.country ?? null,
        personas,
        vehicle_type_id: payload.profile?.vehicle_type_id,
        agent_focus: payload.profile?.agent_focus,
        business_name: businessName,
        main_interest: payload.profile?.main_interest ?? 'sell_items',
        ...this.referralProvisioning.getBusinessInsertReferralFields(
          signupReferral
        ),
        ...this.referralProvisioning.getAgentInsertReferralFields(
          signupReferral
        ),
        storeAddress: nestStoreAddress,
      });
    if (normalizedAddress) {
      await this.seedLegacyAddresses(
        user.id,
        entities,
        normalizedAddress,
        Boolean(businessLocation)
      );
    }
    const { launchPromo } = await this.businessProvisioning.runPostCommitEffects(
      {
        userId: user.id,
        entities,
        businessLocation,
        storeAddress: nestStoreAddress ?? normalizedAddress,
        phoneNumber: payload.phone_number,
        businessName,
        countryCode: normalizedAddress?.country,
      }
    );
    await this.referralProvisioning.runPostCommitEffects({
      entities,
      referral: signupReferral,
      referralAgentCode: payload.referral_agent_code,
      country: normalizedAddress?.country,
      businessName,
      ownerName: `${payload.first_name} ${payload.last_name}`.trim(),
    });
    await this.businessProvisioning.scheduleEnsureContractForUser(user.id);
    this.emitCompleteRegistration(user, payload);
    return {
      tokens,
      user,
      launchPromo: this.mapLaunchPromo(launchPromo),
    };
  }

  private mapLaunchPromo(
    launchPromo: {
      status: string;
      ordersRemaining: number;
      businessLimit: number | null;
      zeroCommissionOrders: number | null;
      identificationWindowDays: number | null;
    } | null
  ): SignupLaunchPromoResult | null {
    if (!launchPromo) return null;
    return {
      status: launchPromo.status,
      ordersRemaining: launchPromo.ordersRemaining,
      businessLimit: launchPromo.businessLimit,
      zeroCommissionOrders: launchPromo.zeroCommissionOrders,
      identificationWindowDays: launchPromo.identificationWindowDays,
    };
  }

  private async prepareSignupAttempt(payload: SignupStartPayload): Promise<{
    channel: SignupAttemptChannel;
    contactValue: string;
    attemptPayload: SignupAttemptPayload;
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
    const personas = this.normalizeSignupPersonas(payload);
    await this.referralProvisioning.resolveSignupReferral(
      personas,
      payload.referral_agent_code
    );
    const country =
      payload.country?.trim().toUpperCase() ||
      payload.address?.country?.trim().toUpperCase() ||
      '';
    const channel = this.resolveChannel(email, phoneNumber, country);
    const contactValue = channel === 'phone' ? phoneNumber : email;
    if (!contactValue) {
      throw new HttpException(
        { success: false, error: 'Email or phone number is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    return {
      channel,
      contactValue,
      attemptPayload: {
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        email: email || null,
        phone_number: phoneNumber || null,
        personas,
        profile: payload.profile || {},
        country: payload.country,
        store_location: payload.store_location,
        address: payload.address,
        referral_agent_code: payload.referral_agent_code,
        fbc: payload.fbc,
        fbp: payload.fbp,
        eventSourceUrl: payload.eventSourceUrl,
        actionSource: payload.actionSource,
        clientIpAddress: payload.clientIpAddress,
        clientUserAgent: payload.clientUserAgent,
      },
    };
  }

  private resolveChannel(
    email: string,
    phoneNumber: string,
    country: string
  ): SignupAttemptChannel {
    if (phoneNumber && isAfricanMarketCountry(country)) return 'phone';
    if (email) return 'email';
    if (phoneNumber) return 'phone';
    return 'email';
  }

  private async sendAttemptOtp(attempt: SignupAttemptRow): Promise<void> {
    if (this.isTestUser(attempt.contact_value, attempt.channel === 'phone')) {
      return;
    }
    if (attempt.channel === 'phone') {
      await this.auth0Service.startSmsOtp(attempt.contact_value);
      return;
    }
    await this.auth0Service.startEmailOtp(attempt.contact_value);
  }

  private toStartResult(attempt: SignupAttemptRow): SignupStartAttemptResult {
    const sentAt = new Date(attempt.last_otp_sent_at).getTime();
    return {
      attemptId: attempt.id,
      channel: attempt.channel,
      contactHint: this.maskContact(attempt.channel, attempt.contact_value),
      expiresAt: attempt.expires_at,
      resendAvailableAt: new Date(
        sentAt + SIGNUP_OTP_RESEND_COOLDOWN_MS
      ).toISOString(),
    };
  }

  private maskContact(
    channel: SignupAttemptChannel,
    value: string
  ): string {
    if (channel === 'email') {
      const [local, domain] = value.split('@');
      if (!domain) return '***';
      const visible = local.slice(0, Math.min(2, local.length));
      return `${visible}***@${domain}`;
    }
    if (value.length <= 4) return '***';
    return `${value.slice(0, 3)}***${value.slice(-2)}`;
  }

  private async requireAttempt(id: string): Promise<SignupAttemptRow> {
    const attemptId = String(id || '').trim();
    if (!attemptId) {
      throw new HttpException(
        { success: false, error: 'attemptId is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const attempt = await this.attemptStore.findById(attemptId);
    if (!attempt) {
      throw new HttpException(
        { success: false, error: 'Signup attempt not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return attempt;
  }

  private async requireActiveAttempt(
    id: string
  ): Promise<SignupAttemptRow> {
    const attempt = await this.requireAttempt(id);
    this.assertAttemptVerifiable(attempt);
    return attempt;
  }

  private assertAttemptVerifiable(attempt: SignupAttemptRow): void {
    if (new Date(attempt.expires_at).getTime() <= Date.now()) {
      void this.attemptStore.updateStatus(attempt.id, 'expired');
      throw new HttpException(
        { success: false, error: 'Signup attempt expired' },
        HttpStatus.GONE
      );
    }
    if (
      attempt.status === 'superseded' ||
      attempt.status === 'failed' ||
      attempt.status === 'expired'
    ) {
      throw new HttpException(
        { success: false, error: 'Signup attempt is no longer valid' },
        HttpStatus.CONFLICT
      );
    }
    if (attempt.status === 'completed') return;
  }

  private assertResendAllowed(attempt: SignupAttemptRow): void {
    const elapsed =
      Date.now() - new Date(attempt.last_otp_sent_at).getTime();
    if (elapsed < SIGNUP_OTP_RESEND_COOLDOWN_MS) {
      throw new HttpException(
        { success: false, error: 'Please wait before requesting another code' },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private async assertContactsStillAvailable(
    payload: SignupAttemptPayload
  ): Promise<void> {
    if (payload.email && (await this.isEmailTaken(payload.email))) {
      throw new HttpException(
        { success: false, error: 'Email is already taken' },
        HttpStatus.CONFLICT
      );
    }
    if (
      payload.phone_number &&
      (await this.isPhoneTaken(payload.phone_number))
    ) {
      throw new HttpException(
        { success: false, error: 'Phone number is already taken' },
        HttpStatus.CONFLICT
      );
    }
  }

  private emitCompleteRegistration(
    user: SignupCreatedUser,
    payload: SignupAttemptPayload
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
        if (businessLocationAlreadyCreated) continue;
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

  private isTestUser(identifier: string, isPhone: boolean): boolean {
    if (!this.auth0Service.isTestUsersEnabled()) return false;
    return isPhone
      ? this.auth0Service.isTestPhone(identifier)
      : this.auth0Service.isTestEmail(identifier);
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

  /** @deprecated Pending-user contact updates are retired; restart signup. */
  async updateContact(_body: unknown): Promise<never> {
    throw new HttpException(
      {
        success: false,
        error: 'Contact updates require restarting signup verification',
      },
      HttpStatus.GONE
    );
  }

  /** @deprecated Completion is now part of verify-otp. */
  async completeSignup(_userId: string, _auth0User: unknown): Promise<never> {
    throw new HttpException(
      {
        success: false,
        error: 'Signup completion is handled by OTP verification',
      },
      HttpStatus.GONE
    );
  }

  /** Legacy path retained for older clients; prefer verifySignupOtp. */
  async verifyOtp(body: {
    email?: string;
    phone_number?: string;
    otp: string;
    userId?: string;
    attemptId?: string;
  }): Promise<Auth0TokenResponse | SignupCompletionResult> {
    if (body.attemptId) {
      return this.verifySignupOtp({
        attemptId: body.attemptId,
        otp: body.otp,
      });
    }
    throw new HttpException(
      {
        success: false,
        error: 'attemptId is required for signup OTP verification',
      },
      HttpStatus.BAD_REQUEST
    );
  }

  async purgeExpiredAttempts(): Promise<number> {
    return this.attemptStore.purgeExpired();
  }
}
