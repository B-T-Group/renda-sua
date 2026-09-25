import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Auth0Service, Auth0TokenResponse } from './auth0.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { BusinessProvisioningService } from './provisioning/business-provisioning.service';
import {
  SessionData,
  SessionStoreService,
} from './session-store.service';
import { LockoutService } from './lockout.service';
import {
  buildOtpIdentifier,
  normalizeOtpDestination,
  OtpSendLimiterService,
} from './otp-send-limiter.service';
import {
  accessTokenTtlSec,
  canReuseAccessToken,
  isInvalidGrantError,
  requireRefreshToken,
} from './session-refresh.util';
import {
  AUTH_REQUEST_FAILED_CODE,
  buildTypedIdentifierOtpOptions,
  isAuthFlowV2,
  toUniformFlowStartResult,
} from './auth-flow.util';
import { AuthFlowV2StoreService } from './auth-flow-v2-store.service';
import { SignupService } from './signup.service';
import { buildIdentifierLockoutKey } from './auth-lockout.util';
import { LoginStartDto } from './dto/login-start.dto';
import { LoginVerifyDto } from './dto/login-verify.dto';
import type { LoginRefreshDto } from './dto/login-refresh.dto';
import { extractHasuraClaimsFromToken } from './request-context.util';
import type { ClientPlatform } from './platform.decorator';
import {
  buildAvailableOtpChannels,
  maskEmailForOtp,
  maskPhoneForOtp,
  type OtpChannel,
} from './otp-channel.util';
import { SiteEventsService } from '../site-events/site-events.service';
import {
  authSendFailReason,
  emitAuthSiteEvent,
  serverAuthViewer,
} from './auth-site-events.helper';

interface Auth0IdTokenClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
}

interface TokenData {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

interface WebLoginResult {
  sessionId: string;
  response: {
    success: boolean;
    verified: boolean;
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in: number;
  };
}

interface MobileLoginResult {
  sessionId?: never;
  response: {
    success: boolean;
    verified: boolean;
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
  };
}

type LoginResult = WebLoginResult | MobileLoginResult;

type RefreshResponse = {
  success: boolean;
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
};

type RefreshResult = {
  newSessionId?: string;
  response: RefreshResponse;
};

export type LoginRefreshOpts = Pick<
  LoginRefreshDto,
  'active_persona' | 'force'
>;

interface LoginUserRow {
  id: string;
  email: string | null;
  phone_number: string | null;
  email_verified: boolean | null;
  phone_number_verified: boolean | null;
}

export interface LoginOtpOptionsResult {
  defaultChannel: OtpChannel;
  availableChannels: OtpChannel[];
  maskedEmail?: string;
  maskedPhone?: string;
}

export interface LoginOtpStartResult extends LoginOtpOptionsResult {
  channel: OtpChannel;
  expiresAt: string;
  codeExpiresAt: string;
  resendAvailableAt: string;
  flowId?: string;
}

export interface AuthFlowV2FinishVerifyResponse {
  success: boolean;
  verified: true;
  next: 'finish_account';
  flowId: string;
}

export type LoginVerifyServiceResult =
  | LoginResult
  | { sessionId?: never; response: AuthFlowV2FinishVerifyResponse };

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly auth0Service: Auth0Service,
    private readonly businessProvisioning: BusinessProvisioningService,
    private readonly sessionStore: SessionStoreService,
    private readonly lockout: LockoutService,
    private readonly otpSendLimiter: OtpSendLimiterService,
    private readonly authFlowV2Store: AuthFlowV2StoreService,
    private readonly signupService: SignupService,
    @Optional() private readonly siteEvents?: SiteEventsService
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizePhone(phone: string): string {
    return String(phone || '').trim();
  }

  private decodeClaimsFromIdToken(idToken: string): Auth0IdTokenClaims {
    const decoded = jwt.decode(idToken) as Auth0IdTokenClaims | null;
    if (!decoded?.sub) {
      throw new HttpException(
        { success: false, error: 'Invalid id_token returned by Auth0' },
        HttpStatus.BAD_GATEWAY
      );
    }
    return decoded;
  }

  private parseIdentifier(body: {
    email?: string;
    phone_number?: string;
  }): { email: string; phone: string } {
    const email = body.email?.trim() ? this.normalizeEmail(body.email) : '';
    const phone = body.phone_number?.trim()
      ? this.normalizePhone(body.phone_number)
      : '';
    if (email && phone) {
      throw new HttpException(
        {
          success: false,
          error: 'Provide either email or phone_number, not both',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    if (!email && !phone) {
      throw new HttpException(
        {
          success: false,
          error: 'Email or phone_number is required',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return { email, phone };
  }

  private async getUserByEmail(email: string): Promise<LoginUserRow | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: LoginUserRow[];
    }>(
      `
      query UserByEmail($email: String!) {
        users(where: { email: { _eq: $email } }, limit: 1) {
          id
          email
          phone_number
          email_verified
          phone_number_verified
        }
      }
    `,
      { email }
    );
    return result.users?.[0] || null;
  }

  private async getUserByPhoneNumber(
    phoneNumber: string
  ): Promise<LoginUserRow | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: LoginUserRow[];
    }>(
      `
      query UserByPhone($phone: String!) {
        users(where: { phone_number: { _eq: $phone } }, limit: 1) {
          id
          email
          phone_number
          email_verified
          phone_number_verified
        }
      }
    `,
      { phone: phoneNumber }
    );
    return result.users?.[0] || null;
  }

  private async findUserByIdentifier(
    email: string,
    phone: string,
    options?: { allowMissing?: boolean }
  ): Promise<LoginUserRow | null> {
    const user = email
      ? await this.getUserByEmail(email)
      : await this.getUserByPhoneNumber(phone);
    if (!user) {
      if (options?.allowMissing) return null;
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return user;
  }

  private throwAuthRequestFailed(): never {
    throw new HttpException(
      {
        success: false,
        error: 'Unable to process request',
        code: AUTH_REQUEST_FAILED_CODE,
      },
      HttpStatus.BAD_REQUEST
    );
  }

  private buildOptionsFromUser(
    user: LoginUserRow,
    defaultChannel: OtpChannel
  ): LoginOtpOptionsResult {
    const availableChannels = buildAvailableOtpChannels({
      email: user.email,
      phoneNumber: user.phone_number,
    });
    return {
      defaultChannel,
      availableChannels,
      maskedEmail: maskEmailForOtp(user.email),
      maskedPhone: maskPhoneForOtp(user.phone_number),
    };
  }

  async getLoginOtpOptions(body: LoginStartDto): Promise<LoginOtpOptionsResult> {
    const { email, phone } = this.parseIdentifier(body);
    if (isAuthFlowV2(body.flow_version)) {
      return buildTypedIdentifierOtpOptions(email, phone);
    }
    const user = await this.findUserByIdentifier(email, phone);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return this.buildOptionsFromUser(user, email ? 'email' : 'sms');
  }

  private resolveDeliveryChannel(
    user: LoginUserRow,
    preferred: OtpChannel | undefined,
    defaultChannel: OtpChannel
  ): OtpChannel {
    const available = buildAvailableOtpChannels({
      email: user.email,
      phoneNumber: user.phone_number,
    });
    const channel = preferred || defaultChannel;
    if (!available.includes(channel)) {
      throw new HttpException(
        {
          success: false,
          error:
            channel === 'sms'
              ? 'No phone number on file for SMS OTP'
              : 'No email on file for email OTP',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return channel;
  }

  private async sendOtpToChannel(
    user: LoginUserRow,
    channel: OtpChannel
  ): Promise<void> {
    if (channel === 'email') {
      const email = this.normalizeEmail(user.email || '');
      if (this.isTestUser(email, false)) return;
      await this.auth0Service.startEmailOtp(email);
      return;
    }
    const phone = this.normalizePhone(user.phone_number || '');
    if (this.isTestUser(phone, true)) return;
    await this.auth0Service.startSmsOtp(phone);
  }

  async startLoginOtp(
    body: LoginStartDto,
    platform: ClientPlatform = 'web',
    ip?: string
  ): Promise<LoginOtpStartResult> {
    const { email, phone } = this.parseIdentifier(body);
    if (isAuthFlowV2(body.flow_version)) {
      return this.startLoginOtpV2(body, email, phone, platform, ip);
    }
    const user = await this.findUserByIdentifier(email, phone);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    const defaultChannel: OtpChannel = email ? 'email' : 'sms';
    const channel = this.resolveDeliveryChannel(
      user,
      body.channel,
      defaultChannel
    );
    const destination = this.otpDestinationForChannel(user, channel);
    const identifier = buildOtpIdentifier({ email, phone });
    await this.ensureNotLockedOut(
      this.lockoutKeysForUser(user, destination, email, phone),
      platform
    );
    await this.otpSendLimiter.assertCanSend({
      destination,
      identifier,
      ip,
      isChannelSwitch: false,
    });
    try {
      await this.sendOtpToChannel(user, channel);
      emitAuthSiteEvent(
        this.siteEvents,
        'auth_code_sent',
        platform,
        { channel, context: 'login' },
        serverAuthViewer(user.id)
      );
    } catch (error: any) {
      emitAuthSiteEvent(
        this.siteEvents,
        'auth_code_send_failed',
        platform,
        {
          channel,
          context: 'login',
          fail_reason: authSendFailReason(error),
        },
        serverAuthViewer(user.id)
      );
      throw error;
    }
    const timing = await this.otpSendLimiter.recordSend({
      destination,
      identifier,
      ip,
      isChannelSwitch: false,
    });
    return {
      channel,
      ...this.buildOptionsFromUser(user, defaultChannel),
      expiresAt: timing.codeExpiresAt,
      codeExpiresAt: timing.codeExpiresAt,
      resendAvailableAt: timing.resendAvailableAt,
    };
  }

  private otpDestinationForChannel(
    user: LoginUserRow,
    channel: OtpChannel
  ): string {
    if (channel === 'email') {
      return normalizeOtpDestination(this.normalizeEmail(user.email || ''), 'email');
    }
    return normalizeOtpDestination(this.normalizePhone(user.phone_number || ''), 'phone');
  }

  private isTestUser(identifier: string, isPhone: boolean): boolean {
    if (!this.auth0Service.isTestUsersEnabled()) return false;
    return isPhone
      ? this.auth0Service.isTestPhone(identifier)
      : this.auth0Service.isTestEmail(identifier);
  }

  private async markEmailVerifiedIfNeeded(
    userId: string,
    shouldVerifyEmail: boolean
  ): Promise<void> {
    if (!shouldVerifyEmail) return;
    await this.hasuraSystemService.executeMutation(
      `
      mutation VerifyLoginEmail($id: uuid!) {
        update_users_by_pk(
          pk_columns: { id: $id }
          _set: { email_verified: true }
        ) {
          id
        }
      }
    `,
      { id: userId }
    );
  }

  private async markPhoneVerifiedIfNeeded(
    userId: string,
    shouldVerifyPhone: boolean
  ): Promise<void> {
    if (!shouldVerifyPhone) return;
    await this.hasuraSystemService.executeMutation(
      `
      mutation VerifyLoginPhone($id: uuid!) {
        update_users_by_pk(
          pk_columns: { id: $id }
          _set: { phone_number_verified: true }
        ) {
          id
        }
      }
    `,
      { id: userId }
    );
  }

  private async ensureNotLockedOut(
    keys: string[],
    platform: ClientPlatform
  ): Promise<void> {
    for (const key of keys) {
      if (!key) continue;
      if (await this.lockout.isLockedOut(key)) {
        await this.throwLockout(key, platform);
      }
    }
  }

  private async recordLockoutFailure(keys: string[]): Promise<void> {
    for (const key of keys) {
      if (!key) continue;
      await this.lockout.recordFailure(key);
    }
  }

  private async recordLockoutSuccess(keys: string[]): Promise<void> {
    for (const key of keys) {
      if (!key) continue;
      await this.lockout.recordSuccess(key);
    }
  }

  private lockoutKeysForParsedIdentifier(
    email: string,
    phone: string
  ): string[] {
    return [buildIdentifierLockoutKey({ email, phone })];
  }

  private lockoutKeysForUser(
    user: LoginUserRow,
    destination: string,
    parsedEmail: string,
    parsedPhone: string
  ): string[] {
    const keys = [
      `user:${user.id}`,
      destination,
      buildIdentifierLockoutKey({
        email: parsedEmail || user.email,
        phone: parsedPhone || user.phone_number,
      }),
    ];
    const email = this.normalizeEmail(user.email || '');
    const phone = this.normalizePhone(user.phone_number || '');
    if (email) keys.push(email);
    if (phone) keys.push(phone);
    return [...new Set(keys.filter(Boolean))];
  }

  async verifyLoginOtp(
    body: LoginVerifyDto,
    platform: ClientPlatform,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginVerifyServiceResult> {
    const otp = body.otp?.trim() || '';
    if (!otp) {
      throw new HttpException(
        { success: false, error: 'OTP is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    if (isAuthFlowV2(body.flow_version) && body.flowId?.trim()) {
      return this.verifyLoginOtpFlowV2(body.flowId.trim(), otp, platform, ipAddress, userAgent);
    }
    const { email, phone } = this.parseIdentifier(body);
    const flowV2 = isAuthFlowV2(body.flow_version);
    const identifierKeys = this.lockoutKeysForParsedIdentifier(email, phone);
    await this.ensureNotLockedOut(identifierKeys, platform);

    const user = await this.findUserByIdentifier(email, phone, {
      allowMissing: flowV2,
    });
    if (!user) {
      return await this.verifyLoginOtpUnknownIdentifier(
        email,
        phone,
        otp,
        identifierKeys
      );
    }
    const defaultChannel: OtpChannel = email ? 'email' : 'sms';
    const channel = body.channel
      ? this.resolveDeliveryChannel(user, body.channel, defaultChannel)
      : defaultChannel;
    if (channel === 'email') {
      return this.verifyLoginOtpWithEmail(
        this.normalizeEmail(user.email || ''),
        otp,
        platform,
        ipAddress,
        userAgent,
        user,
        email,
        phone
      );
    }
    return this.verifyLoginOtpWithPhone(
      this.normalizePhone(user.phone_number || ''),
      otp,
      platform,
      ipAddress,
      userAgent,
      user,
      email,
      phone
    );
  }

  private async verifyLoginOtpUnknownIdentifier(
    email: string,
    phone: string,
    otp: string,
    lockoutKeys: string[]
  ): Promise<never> {
    try {
      if (email) {
        await (this.isTestUser(email, false)
          ? this.auth0Service.verifyTestUserEmail(email)
          : this.auth0Service.verifyEmailOtp(email, otp));
      } else {
        await (this.isTestUser(phone, true)
          ? this.auth0Service.verifyTestUserPhone(phone)
          : this.auth0Service.verifySmsOtp(phone, otp));
      }
      await this.recordLockoutSuccess(lockoutKeys);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      await this.recordLockoutFailure(lockoutKeys);
    }
    this.throwAuthRequestFailed();
  }

  private async verifyLoginOtpWithEmail(
    email: string,
    otp: string,
    platform: ClientPlatform,
    ipAddress?: string,
    userAgent?: string,
    knownUser?: LoginUserRow,
    parsedEmail = '',
    parsedPhone = ''
  ): Promise<LoginResult> {
    const user = knownUser || (await this.getUserByEmail(email));
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    const lockoutKeys = this.lockoutKeysForUser(
      user,
      email,
      parsedEmail || email,
      parsedPhone
    );
    await this.ensureNotLockedOut(lockoutKeys, platform);

    let tokenData: TokenData;
    try {
      tokenData = (await (this.isTestUser(email, false)
        ? this.auth0Service.verifyTestUserEmail(email)
        : this.auth0Service.verifyEmailOtp(email, otp))) as TokenData;
    } catch (error: any) {
      await this.recordLockoutFailure(lockoutKeys);
      emitAuthSiteEvent(
        this.siteEvents,
        'auth_code_failed',
        platform,
        { channel: 'email', context: 'login' },
        serverAuthViewer(user.id)
      );
      throw error;
    }

    await this.recordLockoutSuccess(lockoutKeys);
    this.assertTokenPayload(tokenData);
    this.decodeClaimsFromIdToken(tokenData.id_token!);
    await this.afterSuccessfulVerify(user, 'email');
    emitAuthSiteEvent(
      this.siteEvents,
      'auth_code_verified',
      platform,
      { channel: 'email', is_new_account: false, context: 'login' },
      serverAuthViewer(user.id)
    );
    return this.buildLoginResult(user, tokenData, platform, ipAddress, userAgent);
  }

  private async verifyLoginOtpWithPhone(
    phoneNumber: string,
    otp: string,
    platform: ClientPlatform,
    ipAddress?: string,
    userAgent?: string,
    knownUser?: LoginUserRow,
    parsedEmail = '',
    parsedPhone = ''
  ): Promise<LoginResult> {
    const user = knownUser || (await this.getUserByPhoneNumber(phoneNumber));
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    const lockoutKeys = this.lockoutKeysForUser(
      user,
      phoneNumber,
      parsedEmail,
      parsedPhone || phoneNumber
    );
    await this.ensureNotLockedOut(lockoutKeys, platform);

    let tokenData: TokenData;
    try {
      tokenData = (await (this.isTestUser(phoneNumber, true)
        ? this.auth0Service.verifyTestUserPhone(phoneNumber)
        : this.auth0Service.verifySmsOtp(phoneNumber, otp))) as TokenData;
    } catch (error: any) {
      await this.recordLockoutFailure(lockoutKeys);
      emitAuthSiteEvent(
        this.siteEvents,
        'auth_code_failed',
        platform,
        { channel: 'sms', context: 'login' },
        serverAuthViewer(user.id)
      );
      throw error;
    }

    await this.recordLockoutSuccess(lockoutKeys);
    this.assertTokenPayload(tokenData);
    this.decodeClaimsFromIdToken(tokenData.id_token!);
    await this.afterSuccessfulVerify(user, 'sms');
    emitAuthSiteEvent(
      this.siteEvents,
      'auth_code_verified',
      platform,
      { channel: 'sms', is_new_account: false, context: 'login' },
      serverAuthViewer(user.id)
    );
    return this.buildLoginResult(user, tokenData, platform, ipAddress, userAgent);
  }

  private async throwLockout(
    identifier: string,
    platform: ClientPlatform
  ): Promise<never> {
    emitAuthSiteEvent(
      this.siteEvents,
      'auth_locked',
      platform,
      { context: 'login' },
      serverAuthViewer()
    );
    const remainingMs = await this.lockout.getRemainingLockoutMs(identifier);
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new HttpException(
      {
        success: false,
        error: `Too many failed attempts. Try again in ${remainingMin} minute(s).`,
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private async afterSuccessfulVerify(
    user: LoginUserRow,
    channel: OtpChannel
  ): Promise<void> {
    const needsVerify =
      channel === 'email'
        ? user.email_verified !== true
        : user.phone_number_verified !== true;
    if (!needsVerify) return;
    try {
      await this.businessProvisioning.ensureContractForUser(user.id);
    } catch {
      // Continue even if contract provisioning fails
    }
    if (channel === 'email') {
      await this.markEmailVerifiedIfNeeded(user.id, true);
      return;
    }
    await this.markPhoneVerifiedIfNeeded(user.id, true);
  }

  private async buildLoginResult(
    user: LoginUserRow,
    tokenData: TokenData,
    platform: ClientPlatform,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    if (platform === 'web') {
      const sessionId = this.sessionStore.generateSessionId();
      await this.sessionStore.createSession(sessionId, {
        userId: user.id,
        auth0RefreshToken: requireRefreshToken(tokenData.refresh_token),
        auth0AccessToken: tokenData.access_token,
        auth0IdToken: tokenData.id_token,
        createdAt: Date.now(),
        lastRefreshedAt: Date.now(),
        familyId: sessionId,
        userAgent,
        ipAddress,
      });
      return {
        sessionId,
        response: {
          success: true,
          verified: true,
          access_token: tokenData.access_token,
          id_token: tokenData.id_token,
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in,
        },
      };
    }
    return {
      response: {
        success: true,
        verified: true,
        access_token: tokenData.access_token,
        id_token: tokenData.id_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
      },
    };
  }

  private assertTokenPayload(tokenData: TokenData): void {
    if (!tokenData?.access_token) {
      throw new HttpException(
        { success: false, error: 'Auth0 did not return an access token' },
        HttpStatus.BAD_GATEWAY
      );
    }
    if (!tokenData?.id_token) {
      throw new HttpException(
        { success: false, error: 'Auth0 did not return an id_token' },
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  async refreshSession(
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
    opts?: LoginRefreshOpts
  ): Promise<RefreshResult> {
    const live = await this.requireLiveSession(sessionId);
    const cached = this.cachedRefreshResponse(live.data, opts);
    if (cached) return this.withCookieIfRotated(sessionId, live.id, cached);
    const familyKey = live.data.familyId || live.id;
    return this.sessionStore.runExclusiveRefresh(familyKey, () =>
      this.refreshLocked(sessionId, ipAddress, userAgent, opts)
    );
  }

  private async refreshLocked(
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
    opts?: LoginRefreshOpts
  ) {
    const live = await this.requireLiveSession(sessionId);
    const cached = this.cachedRefreshResponse(live.data, opts);
    if (cached) return this.withCookieIfRotated(sessionId, live.id, cached);
    try {
      return await this.exchangeAndRotate(live, ipAddress, userAgent, opts);
    } catch (error: any) {
      return this.recoverOrThrowRefreshError(sessionId, live.id, error, opts);
    }
  }

  private async requireLiveSession(
    sessionId: string
  ): Promise<{ id: string; data: SessionData }> {
    const live = await this.sessionStore.resolveLiveSession(sessionId);
    if (!live?.data.auth0RefreshToken) {
      throw new HttpException(
        { success: false, error: 'Invalid or expired session' },
        HttpStatus.UNAUTHORIZED
      );
    }
    return live;
  }

  private cachedRefreshResponse(
    session: SessionData,
    opts?: LoginRefreshOpts
  ): RefreshResponse | null {
    if (this.shouldBypassCachedToken(session, opts)) return null;
    if (!canReuseAccessToken(session.auth0AccessToken)) return null;
    const expiresIn = accessTokenTtlSec(session.auth0AccessToken);
    if (expiresIn == null) return null;
    return {
      success: true,
      access_token: session.auth0AccessToken!,
      id_token: session.auth0IdToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
    };
  }

  private shouldBypassCachedToken(
    session: SessionData,
    opts?: LoginRefreshOpts
  ): boolean {
    if (opts?.force) return true;
    if (!opts?.active_persona || !session.auth0AccessToken) return false;
    const role = this.accessTokenDefaultRole(session.auth0AccessToken);
    return role !== opts.active_persona;
  }

  private accessTokenDefaultRole(token: string): string | null {
    try {
      return extractHasuraClaimsFromToken(token).defaultRole ?? null;
    } catch {
      return null;
    }
  }

  private withCookieIfRotated(
    requestedId: string,
    liveId: string,
    response: RefreshResponse
  ): RefreshResult {
    return liveId === requestedId
      ? { response }
      : { newSessionId: liveId, response };
  }

  private async exchangeAndRotate(
    live: { id: string; data: SessionData },
    ipAddress?: string,
    userAgent?: string,
    opts?: LoginRefreshOpts
  ) {
    const refreshed = await this.auth0Service.refreshAccessToken(
      live.data.auth0RefreshToken,
      opts?.active_persona
        ? { activePersona: opts.active_persona }
        : undefined
    );
    await this.persistRefreshedTokens(live.id, live.data, refreshed, ipAddress, userAgent);
    const newSessionId = await this.sessionStore.rotateSession(live.id);
    if (!newSessionId) {
      throw new HttpException(
        { success: false, error: 'Session rotation failed' },
        HttpStatus.UNAUTHORIZED
      );
    }
    return {
      newSessionId,
      response: this.toTokenResponse(refreshed),
    };
  }

  private async persistRefreshedTokens(
    sessionId: string,
    session: SessionData,
    refreshed: Auth0TokenResponse,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.sessionStore.updateSession(sessionId, {
      auth0AccessToken: refreshed.access_token,
      auth0IdToken: refreshed.id_token,
      auth0RefreshToken:
        refreshed.refresh_token || session.auth0RefreshToken,
      lastRefreshedAt: Date.now(),
      userAgent,
      ipAddress,
    });
  }

  private toTokenResponse(refreshed: Auth0TokenResponse) {
    return {
      success: true,
      access_token: refreshed.access_token,
      id_token: refreshed.id_token,
      token_type: refreshed.token_type,
      expires_in: refreshed.expires_in,
    };
  }

  private async recoverOrThrowRefreshError(
    requestedId: string,
    liveId: string,
    error: any,
    opts?: LoginRefreshOpts
  ): Promise<RefreshResult> {
    const recovered = await this.cachedAfterFailure(requestedId, opts);
    if (recovered) return recovered;
    this.logRefreshFailure(error);
    if (isInvalidGrantError(error)) {
      await this.sessionStore.deleteSession(liveId);
    }
    if (error instanceof HttpException && !isInvalidGrantError(error)) {
      throw error;
    }
    throw new HttpException(
      { success: false, error: 'Token refresh failed' },
      HttpStatus.UNAUTHORIZED
    );
  }

  private async cachedAfterFailure(
    sessionId: string,
    opts?: LoginRefreshOpts
  ) {
    try {
      const live = await this.requireLiveSession(sessionId);
      const cached = this.cachedRefreshResponse(live.data, opts);
      return cached
        ? this.withCookieIfRotated(sessionId, live.id, cached)
        : null;
    } catch {
      return null;
    }
  }

  private logRefreshFailure(error: any): void {
    const message = error?.message || error?.response?.error || String(error);
    this.logger.error(`Token refresh failed: ${message}`);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.sessionStore.deleteSession(sessionId);
  }

  private async startLoginOtpV2(
    body: LoginStartDto,
    email: string,
    phone: string,
    platform: ClientPlatform,
    ip?: string
  ): Promise<LoginOtpStartResult> {
    const identifierKeys = this.lockoutKeysForParsedIdentifier(email, phone);
    await this.ensureNotLockedOut(identifierKeys, platform);
    const user = await this.findUserByIdentifier(email, phone, {
      allowMissing: true,
    });
    if (user) {
      return this.startKnownAuthFlowV2(user, email, phone, platform, ip);
    }
    const attempt = await this.signupService.startIdentifierOnlyOtp(
      email,
      phone,
      ip
    );
    return toUniformFlowStartResult(
      attempt.attemptId,
      email,
      phone,
      {
        codeExpiresAt: attempt.codeExpiresAt,
        resendAvailableAt: attempt.resendAvailableAt,
      }
    );
  }

  private async startKnownAuthFlowV2(
    user: LoginUserRow,
    email: string,
    phone: string,
    platform: ClientPlatform,
    ip?: string
  ): Promise<LoginOtpStartResult> {
    const channel: OtpChannel = email ? 'email' : 'sms';
    const destination = email
      ? normalizeOtpDestination(email, 'email')
      : normalizeOtpDestination(phone, 'phone');
    const identifier = buildOtpIdentifier({ email, phone });
    await this.ensureNotLockedOut(
      this.lockoutKeysForUser(user, destination, email, phone),
      platform
    );
    await this.otpSendLimiter.assertCanSend({
      destination,
      identifier,
      ip,
      isChannelSwitch: false,
    });
    await this.sendOtpToChannel(user, channel);
    const timing = await this.otpSendLimiter.recordSend({
      destination,
      identifier,
      ip,
      isChannelSwitch: false,
    });
    const flowId = randomUUID();
    await this.authFlowV2Store.save(flowId, {
      userId: user.id,
      channel,
      email,
      phone,
    });
    return toUniformFlowStartResult(flowId, email, phone, timing);
  }

  private async verifyLoginOtpFlowV2(
    flowId: string,
    otp: string,
    platform: ClientPlatform,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginVerifyServiceResult> {
    const signupResult = await this.tryVerifySignupFlowV2(flowId, otp);
    if (signupResult) return signupResult;
    return this.verifyKnownAuthFlowV2(
      flowId,
      otp,
      platform,
      ipAddress,
      userAgent
    );
  }

  private async tryVerifySignupFlowV2(
    flowId: string,
    otp: string
  ): Promise<LoginVerifyServiceResult | null> {
    try {
      await this.signupService.verifyOtpForAuthFlowV2(flowId, otp);
      return {
        response: {
          success: true,
          verified: true,
          next: 'finish_account',
          flowId,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        const status = error.getStatus();
        if (status === HttpStatus.NOT_FOUND) return null;
        throw error;
      }
      return null;
    }
  }

  private async verifyKnownAuthFlowV2(
    flowId: string,
    otp: string,
    platform: ClientPlatform,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const record = await this.authFlowV2Store.get(flowId);
    if (!record) {
      this.throwAuthRequestFailed();
    }
    const user = await this.loadUserById(record.userId);
    const identifierKeys = this.lockoutKeysForParsedIdentifier(
      record.email,
      record.phone
    );
    await this.ensureNotLockedOut(identifierKeys, platform);
    if (record.channel === 'email') {
      const result = await this.verifyLoginOtpWithEmail(
        this.normalizeEmail(user.email || record.email),
        otp,
        platform,
        ipAddress,
        userAgent,
        user,
        record.email,
        record.phone
      );
      await this.authFlowV2Store.delete(flowId);
      return result;
    }
    const result = await this.verifyLoginOtpWithPhone(
      this.normalizePhone(user.phone_number || record.phone),
      otp,
      platform,
      ipAddress,
      userAgent,
      user,
      record.email,
      record.phone
    );
    await this.authFlowV2Store.delete(flowId);
    return result;
  }

  private async loadUserById(userId: string): Promise<LoginUserRow> {
    const result = await this.hasuraSystemService.executeQuery<{
      users_by_pk: LoginUserRow | null;
    }>(
      `
      query LoginUserById($id: uuid!) {
        users_by_pk(id: $id) {
          id
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
      this.throwAuthRequestFailed();
    }
    return user;
  }
}
