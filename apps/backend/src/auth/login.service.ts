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

  async startLoginOtp(rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail || '');
    if (!email) {
      throw new HttpException(
        { success: false, error: 'Email is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    await this.auth0Service.startEmailOtp(email);
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

  async verifyLoginOtp(rawEmail: string, otp: string): Promise<TokenData> {
    const email = this.normalizeEmail(rawEmail || '');
    if (!email || !otp?.trim()) {
      throw new HttpException(
        { success: false, error: 'Email and OTP are required' },
        HttpStatus.BAD_REQUEST
      );
    }

    const tokenData = (await this.auth0Service.verifyEmailOtp(
      email,
      otp.trim()
    )) as TokenData;

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

    this.decodeClaimsFromIdToken(tokenData.id_token);

    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }

    const shouldVerifyEmail = user.email_verified !== true;
    await this.markEmailVerifiedIfNeeded(user.id, shouldVerifyEmail);

    return tokenData;
  }
}

