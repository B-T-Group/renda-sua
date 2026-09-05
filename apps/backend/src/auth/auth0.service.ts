import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ManagementClient } from 'auth0';
import { Auth0TestUsersConfig, Configuration } from '../config/configuration';

export interface Auth0TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

@Injectable()
export class Auth0Service {
  private managementClient: ManagementClient | null = null;

  constructor(private readonly configService: ConfigService<Configuration>) {}

  private getManagementClient(): ManagementClient {
    if (this.managementClient) return this.managementClient;

    const auth0 = this.configService.get('auth0');

    this.managementClient = new ManagementClient({
      domain: auth0?.domain || '',
      clientId: auth0?.managementClientId,
      clientSecret: auth0?.managementClientSecret,
      audience: auth0?.audience,
    });

    return this.managementClient;
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const client = this.getManagementClient();
    await client.jobs.verifyEmail({ user_id: userId });
  }

  private getPasswordlessApp(): {
    domain: string;
    clientId: string;
    clientSecret?: string;
  } {
    const auth0 = this.configService.get('auth0');
    const domain = auth0?.domain;
    const clientId = auth0?.clientId || auth0?.managementClientId;
    const clientSecret = auth0?.clientSecret || auth0?.managementClientSecret;
    if (!domain || !clientId) {
      throw new Error('Auth0 passwordless configuration is missing');
    }
    return { domain, clientId, clientSecret };
  }

  private throwMappedAuth0Error(error: any, fallbackMessage: string): never {
    const status = Number(error?.response?.status);
    if (status >= 400 && status < 500) {
      throw new HttpException(
        { success: false, error: fallbackMessage },
        status === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_REQUEST
      );
    }
    if (status >= 500) {
      throw new HttpException(
        { success: false, error: fallbackMessage },
        HttpStatus.BAD_GATEWAY
      );
    }
    throw error;
  }

  private async postPasswordlessStart(
    connection: 'email' | 'sms',
    recipient: { email: string } | { phone_number: string }
  ): Promise<void> {
    const { domain, clientId, clientSecret } = this.getPasswordlessApp();
    const body: Record<string, unknown> = {
      client_id: clientId,
      connection,
      send: 'code',
      ...recipient,
    };
    if (clientSecret) {
      body.client_secret = clientSecret;
    }
    try {
      await axios.post(`https://${domain}/passwordless/start`, body);
    } catch (error: any) {
      this.throwMappedAuth0Error(error, 'Unable to send login code');
    }
  }

  async startEmailOtp(email: string): Promise<void> {
    await this.postPasswordlessStart('email', { email });
  }

  async startSmsOtp(phoneNumber: string): Promise<void> {
    await this.postPasswordlessStart('sms', { phone_number: phoneNumber });
  }

  private async postPasswordlessToken(
    username: string,
    otp: string,
    realm: 'email' | 'sms'
  ): Promise<Auth0TokenResponse> {
    const { domain, clientId, clientSecret } = this.getPasswordlessApp();
    if (!clientSecret) {
      throw new Error('Auth0 OTP verification configuration is missing');
    }
    const { data } = await axios.post(`https://${domain}/oauth/token`, {
      grant_type: 'http://auth0.com/oauth/grant-type/passwordless/otp',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      otp,
      realm,
      audience: this.configService.get('auth0')?.audience,
      scope: 'openid profile email offline_access',
    });
    return data;
  }

  private async exchangePasswordlessOtp(
    username: string,
    otp: string,
    realm: 'email' | 'sms'
  ): Promise<Auth0TokenResponse> {
    try {
      return await this.postPasswordlessToken(username, otp, realm);
    } catch (error: any) {
      this.throwMappedAuth0Error(error, 'Invalid or expired code');
    }
  }

  async verifyEmailOtp(email: string, otp: string) {
    return this.exchangePasswordlessOtp(email, otp, 'email');
  }

  async verifySmsOtp(phoneNumber: string, otp: string) {
    return this.exchangePasswordlessOtp(phoneNumber, otp, 'sms');
  }

  async refreshAccessToken(refreshToken: string): Promise<Auth0TokenResponse> {
    const { domain, clientId, clientSecret } = this.getPasswordlessApp();
    if (!clientSecret) {
      throw new Error('Auth0 refresh token configuration is missing');
    }

    try {
      const { data } = await axios.post(`https://${domain}/oauth/token`, {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      });
      return data;
    } catch (error: any) {
      this.throwMappedAuth0Error(error, 'Failed to refresh access token');
    }
  }

  private getTestUsersConfig(): Auth0TestUsersConfig | undefined {
    return this.configService.get('auth0')?.testUsers;
  }

  isTestUsersEnabled(): boolean {
    return this.getTestUsersConfig()?.enabled === true;
  }

  isTestEmail(email: string): boolean {
    const config = this.getTestUsersConfig();
    if (!config) return false;
    return email.trim().toLowerCase().endsWith(`@${config.emailDomain}`);
  }

  isTestPhone(phoneNumber: string): boolean {
    const config = this.getTestUsersConfig();
    if (!config) return false;
    return phoneNumber.replace(/\D/g, '').endsWith(config.phoneSuffix);
  }

  private async ensureTestUser(
    connection: string,
    recipient: { email: string } | { phone_number: string }
  ): Promise<void> {
    const config = this.getTestUsersConfig();
    if (!config) {
      throw new Error('Auth0 test user configuration is missing');
    }
    const client = this.getManagementClient();
    const verified =
      'email' in recipient
        ? { email_verified: true }
        : { phone_verified: true };
    try {
      await client.users.create({
        connection,
        password: config.password,
        ...verified,
        ...recipient,
      });
    } catch (error: any) {
      const status = error?.statusCode || error?.response?.status;
      if (status === 400) {
        throw new HttpException(
          { success: false, error: error?.message || 'Invalid user data' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (status !== 409) {
        throw error;
      }
    }
  }

  private async passwordRealmLogin(
    connection: string,
    username: string
  ): Promise<Auth0TokenResponse> {
    const auth0 = this.configService.get('auth0');
    const config = this.getTestUsersConfig();
    const clientId = auth0?.clientId || auth0?.managementClientId;
    const clientSecret = auth0?.clientSecret || auth0?.managementClientSecret;
    if (!auth0?.domain || !clientId || !clientSecret || !config) {
      throw new Error('Auth0 test user configuration is missing');
    }
    const { data } = await axios.post(`https://${auth0.domain}/oauth/token`, {
      grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password: config.password,
      realm: connection,
      audience: auth0.audience,
      scope: 'openid profile email offline_access',
    });
    return data;
  }

  async verifyTestUserEmail(email: string): Promise<Auth0TokenResponse> {
    const connection = this.getTestUsersConfig()?.emailConnection || '';
    const username = email.trim().toLowerCase();
    await this.ensureTestUser(connection, { email: username });
    return this.passwordRealmLogin(connection, username);
  }

  async verifyTestUserPhone(phoneNumber: string): Promise<Auth0TokenResponse> {
    const connection = this.getTestUsersConfig()?.phoneConnection || '';
    const username = phoneNumber.trim();
    await this.ensureTestUser(connection, { phone_number: username });
    return this.passwordRealmLogin(connection, username);
  }

  async deleteAuth0User(sub: string): Promise<void> {
    if (!sub?.trim()) {
      throw new Error('Auth0 user id (sub) is required');
    }
    const client = this.getManagementClient();
    await client.users.delete({ id: sub });
  }
}
