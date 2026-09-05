import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { Auth0Service } from './auth0.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { BusinessProvisioningService } from './provisioning/business-provisioning.service';
import { SessionStoreService } from './session-store.service';
import { LockoutService } from './lockout.service';
import { LoginStartDto } from './dto/login-start.dto';
import { LoginVerifyDto } from './dto/login-verify.dto';
import type { ClientPlatform } from './platform.decorator';

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

@Injectable()
export class LoginService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly auth0Service: Auth0Service,
    private readonly businessProvisioning: BusinessProvisioningService,
    private readonly sessionStore: SessionStoreService,
    private readonly lockout: LockoutService
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

  private async getUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    email_verified: boolean | null;
  } | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{
        id: string;
        email: string;
        email_verified: boolean | null;
      }>;
    }>(
      `
      query UserByEmail($email: String!) {
        users(where: { email: { _eq: $email } }, limit: 1) {
          id
          email
          email_verified
        }
      }
    `,
      { email }
    );
    return result.users?.[0] || null;
  }

  private async getUserByPhoneNumber(phoneNumber: string): Promise<{
    id: string;
    email: string;
    phone_number: string | null;
    email_verified: boolean | null;
    phone_number_verified: boolean | null;
  } | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{
        id: string;
        email: string;
        phone_number: string | null;
        email_verified: boolean | null;
        phone_number_verified: boolean | null;
      }>;
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

  async startLoginOtp(body: LoginStartDto): Promise<void> {
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
    if (email) {
      await this.startLoginOtpWithEmail(email);
      return;
    }
    if (phone) {
      await this.startLoginOtpWithPhone(phone);
      return;
    }
    throw new HttpException(
      {
        success: false,
        error: 'Email or phone_number is required',
      },
      HttpStatus.BAD_REQUEST
    );
  }

  private isTestUser(identifier: string, isPhone: boolean): boolean {
    if (!this.auth0Service.isTestUsersEnabled()) return false;
    return isPhone
      ? this.auth0Service.isTestPhone(identifier)
      : this.auth0Service.isTestEmail(identifier);
  }

  private async startLoginOtpWithEmail(email: string): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (this.isTestUser(email, false)) return;
    await this.auth0Service.startEmailOtp(email);
  }

  private async startLoginOtpWithPhone(phoneNumber: string): Promise<void> {
    const user = await this.getUserByPhoneNumber(phoneNumber);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (this.isTestUser(phoneNumber, true)) return;
    await this.auth0Service.startSmsOtp(phoneNumber);
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

  async verifyLoginOtp(
    body: LoginVerifyDto,
    platform: ClientPlatform,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const email = body.email?.trim() ? this.normalizeEmail(body.email) : '';
    const phone = body.phone_number?.trim()
      ? this.normalizePhone(body.phone_number)
      : '';
    const otp = body.otp?.trim() || '';
    if ((email && phone) || (!email && !phone)) {
      throw new HttpException(
        {
          success: false,
          error: 'Provide exactly one of email or phone_number with otp',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    if (!otp) {
      throw new HttpException(
        { success: false, error: 'OTP is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    if (email) {
      return this.verifyLoginOtpWithEmail(email, otp, platform, ipAddress, userAgent);
    }
    return this.verifyLoginOtpWithPhone(phone, otp, platform, ipAddress, userAgent);
  }

  private async verifyLoginOtpWithEmail(
    email: string,
    otp: string,
    platform: ClientPlatform,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    // Check lockout status
    if (await this.lockout.isLockedOut(email)) {
      const remainingMs = await this.lockout.getRemainingLockoutMs(email);
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new HttpException(
        { 
          success: false, 
          error: `Too many failed attempts. Try again in ${remainingMin} minute(s).` 
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    let tokenData: TokenData;
    try {
      tokenData = (await (this.isTestUser(email, false)
        ? this.auth0Service.verifyTestUserEmail(email)
        : this.auth0Service.verifyEmailOtp(email, otp))) as TokenData;
    } catch (error: any) {
      await this.lockout.recordFailure(email);
      throw error;
    }

    await this.lockout.recordSuccess(email);
    this.assertTokenPayload(tokenData);
    this.decodeClaimsFromIdToken(tokenData.id_token!);
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    const needsEmailVerify = user.email_verified !== true;
    if (needsEmailVerify) {
      try {
        await this.businessProvisioning.ensureContractForUser(user.id);
      } catch {
        // Continue even if contract provisioning fails
      }
      await this.markEmailVerifiedIfNeeded(user.id, true);
    }

    if (platform === 'web') {
      const sessionId = this.sessionStore.generateSessionId();
      await this.sessionStore.createSession(sessionId, {
        userId: user.id,
        auth0RefreshToken: tokenData.refresh_token!,
        auth0AccessToken: tokenData.access_token,
        auth0IdToken: tokenData.id_token,
        createdAt: Date.now(),
        lastRefreshedAt: Date.now(),
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

  private async verifyLoginOtpWithPhone(
    phoneNumber: string,
    otp: string,
    platform: ClientPlatform,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    // Check lockout status
    if (await this.lockout.isLockedOut(phoneNumber)) {
      const remainingMs = await this.lockout.getRemainingLockoutMs(phoneNumber);
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new HttpException(
        { 
          success: false, 
          error: `Too many failed attempts. Try again in ${remainingMin} minute(s).` 
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    let tokenData: TokenData;
    try {
      tokenData = (await (this.isTestUser(phoneNumber, true)
        ? this.auth0Service.verifyTestUserPhone(phoneNumber)
        : this.auth0Service.verifySmsOtp(phoneNumber, otp))) as TokenData;
    } catch (error: any) {
      await this.lockout.recordFailure(phoneNumber);
      throw error;
    }

    await this.lockout.recordSuccess(phoneNumber);
    this.assertTokenPayload(tokenData);
    this.decodeClaimsFromIdToken(tokenData.id_token!);
    const user = await this.getUserByPhoneNumber(phoneNumber);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    const needsPhoneVerify = user.phone_number_verified !== true;
    if (needsPhoneVerify) {
      try {
        await this.businessProvisioning.ensureContractForUser(user.id);
      } catch {
        // Continue even if contract provisioning fails
      }
      await this.markPhoneVerifiedIfNeeded(user.id, true);
    }

    if (platform === 'web') {
      const sessionId = this.sessionStore.generateSessionId();
      await this.sessionStore.createSession(sessionId, {
        userId: user.id,
        auth0RefreshToken: tokenData.refresh_token!,
        auth0AccessToken: tokenData.access_token,
        auth0IdToken: tokenData.id_token,
        createdAt: Date.now(),
        lastRefreshedAt: Date.now(),
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
    userAgent?: string
  ): Promise<{
    newSessionId?: string;
    response: {
      success: boolean;
      access_token: string;
      id_token?: string;
      token_type: string;
      expires_in: number;
    };
  }> {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      throw new HttpException(
        { success: false, error: 'Invalid or expired session' },
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      const refreshed = await this.auth0Service.refreshAccessToken(
        session.auth0RefreshToken
      );

      const newSessionId = await this.sessionStore.rotateSession(sessionId);
      if (!newSessionId) {
        throw new HttpException(
          { success: false, error: 'Session rotation failed' },
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      await this.sessionStore.updateSession(newSessionId, {
        auth0AccessToken: refreshed.access_token,
        auth0IdToken: refreshed.id_token,
        lastRefreshedAt: Date.now(),
        userAgent,
        ipAddress,
      });

      return {
        newSessionId,
        response: {
          success: true,
          access_token: refreshed.access_token,
          id_token: refreshed.id_token,
          token_type: refreshed.token_type,
          expires_in: refreshed.expires_in,
        },
      };
    } catch (error: any) {
      await this.sessionStore.deleteSession(sessionId);
      throw new HttpException(
        { success: false, error: 'Token refresh failed' },
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.sessionStore.deleteSession(sessionId);
  }
}

