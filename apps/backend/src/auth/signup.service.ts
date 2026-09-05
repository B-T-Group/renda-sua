import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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
import { Auth0Service, Auth0TokenResponse } from './auth0.service';
import { BusinessProvisioningService } from './provisioning/business-provisioning.service';
import { ReferralProvisioningService } from './provisioning/referral-provisioning.service';
import { normalizeSignupAddress } from './provisioning/signup-address.normalize';
import { UserProvisioningService } from './provisioning/user-provisioning.service';
import {
  resolveSignupOtpChannel,
  type SignupOtpChannel,
} from './signup-channel.util';

const ATTEMPT_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 120 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const COMPLETION_TOKEN_TTL_MS = 15 * 60 * 1000;
const SUPERSEDE_OPEN_ATTEMPTS = `
  mutation SupersedeSignupAttempts(
    $where: signup_attempts_bool_exp!
    $now: timestamptz!
  ) {
    update_signup_attempts(
      where: $where
      _set: { status: "expired", updated_at: $now }
    ) { affected_rows }
  }
`;

interface SignupStartPayload {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone_number?: string | null;
  user_type_id?: 'client' | 'agent' | 'business';
  personas?: PersonaId[];
  profile: {
    vehicle_type_id?: string;
    name?: string;
    main_interest?: 'sell_items' | 'rent_items';
    agent_focus?: 'delivery' | 'commercial' | 'both';
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
  verification_channel?: SignupOtpChannel;
  fbc?: string | null;
  fbp?: string | null;
  eventSourceUrl?: string;
  actionSource?: MetaActionSource;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
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

export interface SignupLaunchPromoResult {
  status: string;
  ordersRemaining: number;
  businessLimit: number | null;
  zeroCommissionOrders: number | null;
  identificationWindowDays: number | null;
}

export interface SignupAttemptStartResult {
  attemptId: string;
  channel: SignupOtpChannel;
  expiresAt: string;
  resendAvailableAt: string;
}

interface SignupAttemptRow {
  id: string;
  channel: SignupOtpChannel;
  email: string | null;
  phone_number: string | null;
  payload: SignupStartPayload;
  status: 'pending' | 'otp_verified' | 'provisioning' | 'completed' | 'expired' | 'failed';
  verify_attempts: number;
  last_otp_sent_at: string;
  expires_at: string;
  completed_user_id: string | null;
  completion_result: SignupCompletionSnapshot | null;
}

interface SignupCompletionSnapshot {
  user: SignupCreatedUser;
  launchPromo: SignupLaunchPromoResult | null;
  tokens: Auth0TokenResponse;
  completedAt: string;
}

interface SignupAttemptContactFilter {
  email?: { _eq: string };
  phone_number?: { _eq: string };
}

interface SignupAttemptContactWhere {
  status: { _in: Array<'pending' | 'otp_verified'> };
  _or: SignupAttemptContactFilter[];
}

interface Auth0IdTokenClaims {
  sub?: string;
  email?: string;
  phone_number?: string;
  email_verified?: boolean;
}

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

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

  async startSignup(
    payload: SignupStartPayload
  ): Promise<SignupAttemptStartResult> {
    void this.cleanupExpiredAttempts();
    const email = this.normalizeEmail(payload.email);
    const phoneNumber = this.normalizePhone(payload.phone_number);
    this.assertHasContact(email, phoneNumber);
    await this.assertContactsAvailable(email, phoneNumber);
    const personas = this.normalizeSignupPersonas(payload);
    this.assertStoreLocationCountry(payload);
    const channel = this.resolveChannel(payload, email, phoneNumber);
    const expiresAt = new Date(Date.now() + ATTEMPT_TTL_MS).toISOString();
    const attempt = await this.insertAttempt({
      channel,
      email: email || null,
      phone_number: phoneNumber || null,
      payload: { ...payload, email: email || null, phone_number: phoneNumber || null, personas },
      expires_at: expiresAt,
    });
    await this.sendOtpForAttempt(attempt);
    return this.toStartResult(attempt);
  }

  async resendSignupOtp(attemptId: string): Promise<SignupAttemptStartResult> {
    const attempt = await this.loadAttempt(attemptId);
    this.assertAttemptResendable(attempt);
    const cooldownEnds = this.resendAvailableAt(attempt.last_otp_sent_at);
    if (Date.now() < cooldownEnds.getTime()) {
      throw new HttpException(
        {
          success: false,
          error: 'Please wait before requesting another code',
          resendAvailableAt: cooldownEnds.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    await this.sendOtpForAttempt(attempt);
    const updated = await this.touchOtpSent(attempt.id);
    return this.toStartResult(updated);
  }

  async verifySignupOtp(body: {
    attemptId: string;
    otp: string;
  }): Promise<{
    tokens: Auth0TokenResponse;
    user: SignupCreatedUser;
    launchPromo: SignupLaunchPromoResult | null;
  }> {
    const otp = String(body.otp || '').trim();
    if (!otp) {
      throw new HttpException(
        { success: false, error: 'OTP is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const attempt = await this.loadAttempt(body.attemptId);
    if (attempt.status === 'completed' && attempt.completion_result) {
      return this.replayCompletion(attempt.completion_result);
    }
    this.assertAttemptVerifiable(attempt);
    if (attempt.status === 'otp_verified' || attempt.status === 'provisioning') {
      return this.provisionFromVerifiedAttempt(attempt);
    }
    let tokens: Auth0TokenResponse;
    try {
      tokens = await this.verifyOtpAgainstAuth0(attempt, otp);
    } catch (error: any) {
      await this.incrementVerifyAttempts(attempt);
      throw error;
    }
    this.assertTokenMatchesAttempt(tokens, attempt);
    await this.markOtpVerified(attempt.id, tokens);
    const verified: SignupAttemptRow = {
      ...attempt,
      status: 'otp_verified',
      completion_result: {
        user: {
          id: '',
          email: attempt.email,
          first_name: attempt.payload.first_name,
          last_name: attempt.payload.last_name,
          user_type_id: 'client',
          phone_number: attempt.phone_number,
          email_verified: false,
        },
        launchPromo: null,
        tokens,
        completedAt: new Date().toISOString(),
      },
    };
    return this.provisionFromVerifiedAttempt(verified, tokens);
  }

  /** @deprecated Pending-user contact updates are no longer supported. */
  async updateContact(): Promise<never> {
    throw new HttpException(
      {
        success: false,
        error:
          'Contact updates for pending signups are no longer supported. Restart signup with corrected details.',
      },
      HttpStatus.GONE
    );
  }

  /** @deprecated Completion is now part of verify-otp. */
  async completeSignup(): Promise<never> {
    throw new HttpException(
      {
        success: false,
        error: 'Use /auth/signup/verify-otp to complete signup',
      },
      HttpStatus.GONE
    );
  }

  private assertHasContact(email: string, phoneNumber: string): void {
    if (!email && !phoneNumber) {
      throw new HttpException(
        { success: false, error: 'Email or phone number is required' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async assertContactsAvailable(
    email: string,
    phoneNumber: string
  ): Promise<void> {
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
  }

  private assertStoreLocationCountry(payload: SignupStartPayload): void {
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
  }

  private resolveChannel(
    payload: SignupStartPayload,
    email: string,
    phoneNumber: string
  ): SignupOtpChannel {
    try {
      return resolveSignupOtpChannel({
        email,
        phoneNumber,
        country: payload.country || payload.address?.country,
        preferred: payload.verification_channel,
      });
    } catch {
      throw new HttpException(
        { success: false, error: 'Email or phone number is required' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private toStartResult(attempt: SignupAttemptRow): SignupAttemptStartResult {
    return {
      attemptId: attempt.id,
      channel: attempt.channel,
      expiresAt: attempt.expires_at,
      resendAvailableAt: this.resendAvailableAt(
        attempt.last_otp_sent_at
      ).toISOString(),
    };
  }

  private resendAvailableAt(lastSentAt: string): Date {
    return new Date(new Date(lastSentAt).getTime() + RESEND_COOLDOWN_MS);
  }

  private async insertAttempt(input: {
    channel: SignupOtpChannel;
    email: string | null;
    phone_number: string | null;
    payload: SignupStartPayload;
    expires_at: string;
  }): Promise<SignupAttemptRow> {
    await this.expireOpenAttemptsForContact(input.email, input.phone_number);
    const result = await this.hasuraSystemService.executeMutation<{
      insert_signup_attempts_one: SignupAttemptRow;
    }>(
      `
      mutation InsertSignupAttempt(
        $channel: String!
        $email: String
        $phone_number: String
        $payload: jsonb!
        $expires_at: timestamptz!
      ) {
        insert_signup_attempts_one(object: {
          channel: $channel
          email: $email
          phone_number: $phone_number
          payload: $payload
          expires_at: $expires_at
          status: "pending"
        }) {
          id
          channel
          email
          phone_number
          payload
          status
          verify_attempts
          last_otp_sent_at
          expires_at
          completed_user_id
          completion_result
        }
      }
    `,
      input
    );
    return result.insert_signup_attempts_one;
  }

  private async expireOpenAttemptsForContact(
    email: string | null,
    phoneNumber: string | null
  ): Promise<void> {
    const where = this.openAttemptContactWhere(email, phoneNumber);
    if (!where) return;
    await this.hasuraSystemService.executeMutation(SUPERSEDE_OPEN_ATTEMPTS, {
      where,
      now: new Date().toISOString(),
    });
  }

  private openAttemptContactWhere(
    email: string | null,
    phoneNumber: string | null
  ): SignupAttemptContactWhere | null {
    const contacts: SignupAttemptContactFilter[] = [];
    if (email) contacts.push({ email: { _eq: email } });
    if (phoneNumber) contacts.push({ phone_number: { _eq: phoneNumber } });
    if (!contacts.length) return null;
    return { status: { _in: ['pending', 'otp_verified'] }, _or: contacts };
  }

  private async loadAttempt(attemptId: string): Promise<SignupAttemptRow> {
    const id = String(attemptId || '').trim();
    if (!id) {
      throw new HttpException(
        { success: false, error: 'attemptId is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const result = await this.hasuraSystemService.executeQuery<{
      signup_attempts_by_pk: SignupAttemptRow | null;
    }>(
      `
      query SignupAttempt($id: uuid!) {
        signup_attempts_by_pk(id: $id) {
          id
          channel
          email
          phone_number
          payload
          status
          verify_attempts
          last_otp_sent_at
          expires_at
          completed_user_id
          completion_result
        }
      }
    `,
      { id }
    );
    const attempt = result.signup_attempts_by_pk;
    if (!attempt) {
      throw new HttpException(
        { success: false, error: 'Signup attempt not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return attempt;
  }

  private assertAttemptResendable(attempt: SignupAttemptRow): void {
    if (attempt.status === 'completed') {
      throw new HttpException(
        { success: false, error: 'Signup already completed' },
        HttpStatus.CONFLICT
      );
    }
    if (attempt.status === 'failed' || this.isExpired(attempt)) {
      throw new HttpException(
        {
          success: false,
          error: 'Signup attempt expired. Please start again.',
        },
        HttpStatus.GONE
      );
    }
  }

  private assertAttemptVerifiable(attempt: SignupAttemptRow): void {
    if (attempt.status === 'failed' || attempt.status === 'expired') {
      throw new HttpException(
        {
          success: false,
          error: 'Signup attempt expired. Please start again.',
        },
        HttpStatus.GONE
      );
    }
    // OTP TTL only applies before Auth0 verification; post-OTP provision can retry.
    if (attempt.status === 'pending' && this.isExpired(attempt)) {
      throw new HttpException(
        {
          success: false,
          error: 'Signup attempt expired. Please start again.',
        },
        HttpStatus.GONE
      );
    }
    if (
      attempt.status === 'pending' &&
      attempt.verify_attempts >= MAX_VERIFY_ATTEMPTS
    ) {
      void this.markAttemptFailed(attempt.id);
      throw new HttpException(
        {
          success: false,
          error: 'Too many invalid codes. Please start signup again.',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private isExpired(attempt: SignupAttemptRow): boolean {
    return (
      attempt.status === 'expired' ||
      new Date(attempt.expires_at).getTime() <= Date.now()
    );
  }

  private async sendOtpForAttempt(attempt: SignupAttemptRow): Promise<void> {
    if (attempt.channel === 'email') {
      const email = this.normalizeEmail(attempt.email);
      if (this.isTestUser(email, false)) return;
      await this.auth0Service.startEmailOtp(email);
      return;
    }
    const phone = this.normalizePhone(attempt.phone_number);
    if (this.isTestUser(phone, true)) return;
    await this.auth0Service.startSmsOtp(phone);
  }

  private async touchOtpSent(attemptId: string): Promise<SignupAttemptRow> {
    const result = await this.hasuraSystemService.executeMutation<{
      update_signup_attempts_by_pk: SignupAttemptRow;
    }>(
      `
      mutation TouchSignupOtp($id: uuid!, $sentAt: timestamptz!) {
        update_signup_attempts_by_pk(
          pk_columns: { id: $id }
          _set: { last_otp_sent_at: $sentAt, updated_at: $sentAt }
        ) {
          id
          channel
          email
          phone_number
          payload
          status
          verify_attempts
          last_otp_sent_at
          expires_at
          completed_user_id
          completion_result
        }
      }
    `,
      { id: attemptId, sentAt: new Date().toISOString() }
    );
    return result.update_signup_attempts_by_pk;
  }

  private async incrementVerifyAttempts(
    attempt: SignupAttemptRow
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation IncSignupVerifyAttempts($id: uuid!, $n: Int!, $updatedAt: timestamptz!) {
        update_signup_attempts_by_pk(
          pk_columns: { id: $id }
          _set: { verify_attempts: $n, updated_at: $updatedAt }
        ) { id }
      }
    `,
      {
        id: attempt.id,
        n: attempt.verify_attempts + 1,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  private async markOtpVerified(
    attemptId: string,
    tokens: Auth0TokenResponse
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation MarkSignupOtpVerified(
        $id: uuid!
        $updatedAt: timestamptz!
        $result: jsonb!
      ) {
        update_signup_attempts_by_pk(
          pk_columns: { id: $id }
          _set: {
            status: "otp_verified"
            updated_at: $updatedAt
            completion_result: $result
          }
        ) { id }
      }
    `,
      {
        id: attemptId,
        updatedAt: new Date().toISOString(),
        result: {
          tokens,
          completedAt: new Date().toISOString(),
          pendingProvision: true,
        },
      }
    );
  }

  private async markAttemptFailed(attemptId: string): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(
        `
        mutation FailSignupAttempt($id: uuid!, $updatedAt: timestamptz!) {
          update_signup_attempts_by_pk(
            pk_columns: { id: $id }
            _set: { status: "failed", updated_at: $updatedAt, payload: {}, email: null, phone_number: null }
          ) { id }
        }
      `,
        { id: attemptId, updatedAt: new Date().toISOString() }
      );
    } catch (error: any) {
      this.logger.warn(`Failed to mark signup attempt failed: ${error?.message}`);
    }
  }

  private async verifyOtpAgainstAuth0(
    attempt: SignupAttemptRow,
    otp: string
  ): Promise<Auth0TokenResponse> {
    if (attempt.channel === 'email') {
      const email = this.normalizeEmail(attempt.email);
      if (this.isTestUser(email, false)) {
        return this.auth0Service.verifyTestUserEmail(email);
      }
      return this.auth0Service.verifyEmailOtp(email, otp);
    }
    const phone = this.normalizePhone(attempt.phone_number);
    if (this.isTestUser(phone, true)) {
      return this.auth0Service.verifyTestUserPhone(phone);
    }
    return this.auth0Service.verifySmsOtp(phone, otp);
  }

  private assertTokenMatchesAttempt(
    tokens: Auth0TokenResponse,
    attempt: SignupAttemptRow
  ): void {
    if (!tokens?.access_token) {
      throw new HttpException(
        { success: false, error: 'Auth0 did not return an access token' },
        HttpStatus.BAD_GATEWAY
      );
    }
    if (!tokens.id_token) return;
    const claims = jwt.decode(tokens.id_token) as Auth0IdTokenClaims | null;
    if (!claims?.sub) {
      throw new HttpException(
        { success: false, error: 'Invalid id_token returned by Auth0' },
        HttpStatus.BAD_GATEWAY
      );
    }
    if (attempt.channel === 'email') {
      const claimed = this.normalizeEmail(claims.email);
      const expected = this.normalizeEmail(attempt.email);
      if (claimed && expected && claimed !== expected) {
        throw new HttpException(
          { success: false, error: 'Verified identity does not match signup' },
          HttpStatus.CONFLICT
        );
      }
      return;
    }
    const claimedPhone = this.normalizePhone(claims.phone_number);
    const expectedPhone = this.normalizePhone(attempt.phone_number);
    if (claimedPhone && expectedPhone && claimedPhone !== expectedPhone) {
      throw new HttpException(
        { success: false, error: 'Verified identity does not match signup' },
        HttpStatus.CONFLICT
      );
    }
  }

  private replayCompletion(snapshot: SignupCompletionSnapshot): {
    tokens: Auth0TokenResponse;
    user: SignupCreatedUser;
    launchPromo: SignupLaunchPromoResult | null;
  } {
    const age = Date.now() - new Date(snapshot.completedAt).getTime();
    if (age > COMPLETION_TOKEN_TTL_MS || !snapshot.tokens?.access_token) {
      throw new HttpException(
        {
          success: false,
          error: 'Signup already completed. Please log in.',
        },
        HttpStatus.CONFLICT
      );
    }
    return {
      tokens: snapshot.tokens,
      user: snapshot.user,
      launchPromo: snapshot.launchPromo,
    };
  }

  private async provisionFromVerifiedAttempt(
    attempt: SignupAttemptRow,
    tokens?: Auth0TokenResponse
  ): Promise<{
    tokens: Auth0TokenResponse;
    user: SignupCreatedUser;
    launchPromo: SignupLaunchPromoResult | null;
  }> {
    if (attempt.status === 'completed' && attempt.completion_result?.user?.id) {
      return this.replayCompletion(attempt.completion_result);
    }
    const authTokens = tokens || attempt.completion_result?.tokens;
    if (!authTokens?.access_token) {
      throw new HttpException(
        {
          success: false,
          error:
            'Verification succeeded earlier but provisioning is incomplete. Please retry.',
        },
        HttpStatus.CONFLICT
      );
    }
    const claimed = await this.claimAttemptForProvisioning(attempt.id);
    if (!claimed) {
      const latest = await this.loadAttempt(attempt.id);
      if (latest.status === 'completed' && latest.completion_result?.user?.id) {
        return this.replayCompletion(latest.completion_result);
      }
      const staleClaimed = await this.claimStaleProvisioningAttempt(attempt.id);
      if (!staleClaimed) {
        throw new HttpException(
          {
            success: false,
            error: 'Signup is already being completed. Please retry shortly.',
          },
          HttpStatus.CONFLICT
        );
      }
    }
    try {
      return await this.finishProvisioning(attempt, authTokens);
    } catch (error: any) {
      await this.releaseProvisioningClaim(attempt.id, authTokens);
      throw error;
    }
  }

  private async finishProvisioning(
    attempt: SignupAttemptRow,
    authTokens: Auth0TokenResponse
  ): Promise<{
    tokens: Auth0TokenResponse;
    user: SignupCreatedUser;
    launchPromo: SignupLaunchPromoResult | null;
  }> {
    const payload = attempt.payload;
    const email = this.normalizeEmail(payload.email || attempt.email);
    const phoneNumber = this.normalizePhone(
      payload.phone_number || attempt.phone_number
    );
    const existing = await this.findExistingUserByContacts(email, phoneNumber);
    const provisioned = existing
      ? await this.createVerifiedUser({
          payload,
          personas: this.normalizeSignupPersonas(payload),
          email,
          phoneNumber,
          channel: attempt.channel,
          resumeUserId: existing.id,
        })
      : await this.createFreshProvisionedUser(
          attempt,
          email,
          phoneNumber,
          payload
        );
    const snapshot: SignupCompletionSnapshot = {
      user: provisioned.user,
      launchPromo: provisioned.launchPromo,
      tokens: authTokens,
      completedAt: new Date().toISOString(),
    };
    await this.markAttemptCompleted(attempt.id, provisioned.user.id, snapshot);
    return {
      tokens: authTokens,
      user: provisioned.user,
      launchPromo: provisioned.launchPromo,
    };
  }

  private async createFreshProvisionedUser(
    attempt: SignupAttemptRow,
    email: string,
    phoneNumber: string,
    payload: SignupStartPayload
  ): Promise<{
    user: SignupCreatedUser;
    launchPromo: SignupLaunchPromoResult | null;
  }> {
    await this.assertContactsAvailable(email, phoneNumber);
    return this.createVerifiedUser({
      payload,
      personas: this.normalizeSignupPersonas(payload),
      email,
      phoneNumber,
      channel: attempt.channel,
    });
  }

  private async findExistingUserByContacts(
    email: string,
    phoneNumber: string
  ): Promise<SignupCreatedUser | null> {
    if (email) {
      const byEmail = await this.loadUserByContact('email', email);
      if (byEmail) return byEmail;
    }
    if (phoneNumber) {
      return this.loadUserByContact('phone_number', phoneNumber);
    }
    return null;
  }

  private async loadUserByContact(
    field: 'email' | 'phone_number',
    value: string
  ): Promise<SignupCreatedUser | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: SignupCreatedUser[];
    }>(
      `
      query LoadSignupUserByContact($value: String!) {
        users(where: { ${field}: { _eq: $value } }, limit: 1) {
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
      { value }
    );
    return result.users?.[0] || null;
  }

  /**
   * Atomically claim an attempt for provisioning so concurrent verify calls
   * cannot create duplicate users.
   */
  private async claimAttemptForProvisioning(attemptId: string): Promise<boolean> {
    const result = await this.hasuraSystemService.executeMutation<{
      update_signup_attempts: { affected_rows: number };
    }>(
      `
      mutation ClaimSignupAttempt($id: uuid!, $updatedAt: timestamptz!) {
        update_signup_attempts(
          where: {
            id: { _eq: $id }
            status: { _in: ["pending", "otp_verified"] }
            completed_user_id: { _is_null: true }
          }
          _set: { status: "provisioning", updated_at: $updatedAt }
        ) {
          affected_rows
        }
      }
    `,
      { id: attemptId, updatedAt: new Date().toISOString() }
    );
    return (result.update_signup_attempts?.affected_rows || 0) === 1;
  }

  /** Reclaim attempts stuck in provisioning after a crashed worker (2+ minutes). */
  private async claimStaleProvisioningAttempt(
    attemptId: string
  ): Promise<boolean> {
    const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const result = await this.hasuraSystemService.executeMutation<{
      update_signup_attempts: { affected_rows: number };
    }>(
      `
      mutation ClaimStaleSignupProvision(
        $id: uuid!
        $updatedAt: timestamptz!
        $staleBefore: timestamptz!
      ) {
        update_signup_attempts(
          where: {
            id: { _eq: $id }
            status: { _eq: "provisioning" }
            completed_user_id: { _is_null: true }
            updated_at: { _lt: $staleBefore }
          }
          _set: { status: "provisioning", updated_at: $updatedAt }
        ) {
          affected_rows
        }
      }
    `,
      {
        id: attemptId,
        updatedAt: new Date().toISOString(),
        staleBefore,
      }
    );
    return (result.update_signup_attempts?.affected_rows || 0) === 1;
  }

  private async releaseProvisioningClaim(
    attemptId: string,
    tokens: Auth0TokenResponse
  ): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(
        `
        mutation ReleaseSignupProvisionClaim(
          $id: uuid!
          $updatedAt: timestamptz!
          $result: jsonb!
        ) {
          update_signup_attempts(
            where: {
              id: { _eq: $id }
              status: { _eq: "provisioning" }
              completed_user_id: { _is_null: true }
            }
            _set: {
              status: "otp_verified"
              updated_at: $updatedAt
              completion_result: $result
            }
          ) {
            affected_rows
          }
        }
      `,
        {
          id: attemptId,
          updatedAt: new Date().toISOString(),
          result: {
            tokens,
            completedAt: new Date().toISOString(),
            pendingProvision: true,
          },
        }
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to release signup provisioning claim: ${error?.message}`
      );
    }
  }

  private async createVerifiedUser(input: {
    payload: SignupStartPayload;
    personas: PersonaId[];
    email: string;
    phoneNumber: string;
    channel: SignupOtpChannel;
    resumeUserId?: string;
  }): Promise<{
    user: SignupCreatedUser;
    launchPromo: SignupLaunchPromoResult | null;
  }> {
    const { payload, personas, email, phoneNumber, channel } = input;
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
    const businessReferralFields =
      this.referralProvisioning.getBusinessInsertReferralFields(signupReferral);
    const agentReferralFields =
      this.referralProvisioning.getAgentInsertReferralFields(signupReferral);
    const businessName =
      payload.profile?.name?.trim() || `${payload.first_name}'s Business`;
    const nestStoreAddress =
      personas.includes('business') &&
      normalizedAddress &&
      !normalizedAddress.countryOnly
        ? normalizedAddress
        : undefined;
    const { user, entities, businessLocation } = input.resumeUserId
      ? await this.loadProvisionedUserContext(input.resumeUserId)
      : await this.userProvisioning.createPendingUser({
          email: email || null,
          first_name: payload.first_name,
          last_name: payload.last_name,
          phone_number: phoneNumber || null,
          email_verified: channel === 'email',
          country: normalizedAddress?.country ?? null,
          personas,
          vehicle_type_id: payload.profile?.vehicle_type_id,
          agent_focus: payload.profile?.agent_focus,
          business_name: businessName,
          main_interest: payload.profile?.main_interest ?? 'sell_items',
          ...businessReferralFields,
          ...agentReferralFields,
          storeAddress: nestStoreAddress,
        });
    await this.markPhoneVerifiedIfNeeded(user.id, channel === 'sms');
    if (normalizedAddress && !input.resumeUserId) {
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
      referral: signupReferral,
      referralAgentCode: payload.referral_agent_code,
      country: normalizedAddress?.country,
      businessName,
      ownerName: `${payload.first_name} ${payload.last_name}`.trim(),
    });
    await this.businessProvisioning.scheduleEnsureContractForUser(user.id);
    this.emitCompleteRegistration(user, payload);
    return {
      user: {
        ...user,
        email_verified: channel === 'email' ? true : user.email_verified,
      },
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

  private async loadProvisionedUserContext(userId: string): Promise<{
    user: SignupCreatedUser;
    entities: Array<{ id: string; type: PersonaId }>;
    businessLocation?: {
      id: string;
      addressId: string;
      country: string;
      city: string;
    };
  }> {
    const result = await this.hasuraSystemService.executeQuery<{
      users_by_pk: {
        id: string;
        email: string | null;
        first_name: string;
        last_name: string;
        user_type_id: string;
        phone_number: string | null;
        email_verified: boolean;
        client?: { id: string } | null;
        agent?: { id: string } | null;
        business?: {
          id: string;
          business_locations?: Array<{
            id: string;
            address_id: string;
            address?: { country: string; city: string };
          }>;
        } | null;
      } | null;
    }>(
      `
      query LoadProvisionedSignupUser($id: uuid!) {
        users_by_pk(id: $id) {
          id
          email
          first_name
          last_name
          user_type_id
          phone_number
          email_verified
          client { id }
          agent { id }
          business {
            id
            business_locations(limit: 1) {
              id
              address_id
              address { country city }
            }
          }
        }
      }
    `,
      { id: userId }
    );
    const row = result.users_by_pk;
    if (!row) {
      throw new HttpException(
        { success: false, error: 'Signup user not found for resume' },
        HttpStatus.CONFLICT
      );
    }
    const entities: Array<{ id: string; type: PersonaId }> = [];
    if (row.client?.id) entities.push({ id: row.client.id, type: 'client' });
    if (row.agent?.id) entities.push({ id: row.agent.id, type: 'agent' });
    if (row.business?.id) {
      entities.push({ id: row.business.id, type: 'business' });
    }
    const loc = row.business?.business_locations?.[0];
    return {
      user: {
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        user_type_id: row.user_type_id,
        phone_number: row.phone_number,
        email_verified: row.email_verified,
      },
      entities,
      businessLocation: loc?.id
        ? {
            id: loc.id,
            addressId: loc.address_id,
            country: loc.address?.country ?? '',
            city: loc.address?.city ?? '',
          }
        : undefined,
    };
  }

  private async markPhoneVerifiedIfNeeded(
    userId: string,
    shouldVerify: boolean
  ): Promise<void> {
    if (!shouldVerify) return;
    await this.hasuraSystemService.executeMutation(
      `
      mutation MarkSignupPhoneVerified($id: uuid!) {
        update_users_by_pk(
          pk_columns: { id: $id }
          _set: { phone_number_verified: true }
        ) { id }
      }
    `,
      { id: userId }
    );
  }

  private async markAttemptCompleted(
    attemptId: string,
    userId: string,
    snapshot: SignupCompletionSnapshot
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation CompleteSignupAttempt(
        $id: uuid!
        $userId: uuid!
        $result: jsonb!
        $updatedAt: timestamptz!
      ) {
        update_signup_attempts_by_pk(
          pk_columns: { id: $id }
          _set: {
            status: "completed"
            completed_user_id: $userId
            completion_result: $result
            updated_at: $updatedAt
            payload: {}
            email: null
            phone_number: null
          }
        ) { id }
      }
    `,
      {
        id: attemptId,
        userId,
        result: snapshot,
        updatedAt: new Date().toISOString(),
      }
    );
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

  async purgeExpiredAttempts(): Promise<number> {
    return this.cleanupExpiredAttempts();
  }

  private async cleanupExpiredAttempts(): Promise<number> {
    try {
      const result = await this.hasuraSystemService.executeMutation<{
        update_signup_attempts: { affected_rows: number };
      }>(
        `
        mutation CleanupExpiredSignupAttempts($now: timestamptz!) {
          update_signup_attempts(
            where: {
              status: { _eq: "pending" }
              expires_at: { _lt: $now }
            }
            _set: {
              status: "expired"
              payload: {}
              email: null
              phone_number: null
              updated_at: $now
            }
          ) { affected_rows }
        }
      `,
        { now: new Date().toISOString() }
      );
      return result.update_signup_attempts?.affected_rows || 0;
    } catch (error: any) {
      this.logger.warn(`Signup attempt cleanup failed: ${error?.message}`);
      return 0;
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
}
