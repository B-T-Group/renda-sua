import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { Auth0Service } from './auth0.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

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

@Injectable()
export class LoginService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly auth0Service: Auth0Service
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

  async startLoginOtp(body: {
    email?: string;
    phone_number?: string;
  }): Promise<void> {
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

  async verifyLoginOtp(body: {
    email?: string;
    phone_number?: string;
    otp: string;
  }): Promise<TokenData> {
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
      return this.verifyLoginOtpWithEmail(email, otp);
    }
    return this.verifyLoginOtpWithPhone(phone, otp);
  }

  private async verifyLoginOtpWithEmail(
    email: string,
    otp: string
  ): Promise<TokenData> {
    const tokenData = (await (this.isTestUser(email, false)
      ? this.auth0Service.verifyTestUserEmail(email)
      : this.auth0Service.verifyEmailOtp(email, otp))) as TokenData;
    this.assertTokenPayload(tokenData);
    this.decodeClaimsFromIdToken(tokenData.id_token!);
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    await this.markEmailVerifiedIfNeeded(user.id, user.email_verified !== true);
    return tokenData;
  }

  private async verifyLoginOtpWithPhone(
    phoneNumber: string,
    otp: string
  ): Promise<TokenData> {
    const tokenData = (await (this.isTestUser(phoneNumber, true)
      ? this.auth0Service.verifyTestUserPhone(phoneNumber)
      : this.auth0Service.verifySmsOtp(phoneNumber, otp))) as TokenData;
    this.assertTokenPayload(tokenData);
    this.decodeClaimsFromIdToken(tokenData.id_token!);
    const user = await this.getUserByPhoneNumber(phoneNumber);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    await this.markPhoneVerifiedIfNeeded(
      user.id,
      user.phone_number_verified !== true
    );
    return tokenData;
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
}

