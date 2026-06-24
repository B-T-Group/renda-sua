import { Injectable } from '@nestjs/common';
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

  private async postPasswordlessStart(
    connection: 'email' | 'sms',
    recipient: { email: string } | { phone_number: string }
  ): Promise<void> {
    const auth0 = this.configService.get('auth0');
    const domain = auth0?.domain;
    const clientId = auth0?.clientId || auth0?.managementClientId;
    const clientSecret = auth0?.clientSecret || auth0?.managementClientSecret;
    if (!domain || !clientId) {
      throw new Error('Auth0 passwordless configuration is missing');
    }
    const body: Record<string, unknown> = {
      client_id: clientId,
      connection,
      send: 'code',
      ...recipient,
    };
    if (clientSecret) {
      body.client_secret = clientSecret;
    }
    await axios.post(`https://${domain}/passwordless/start`, body);
  }

  async startEmailOtp(email: string): Promise<void> {
    await this.postPasswordlessStart('email', { email });
  }

  async startSmsOtp(phoneNumber: string): Promise<void> {
    await this.postPasswordlessStart('sms', { phone_number: phoneNumber });
  }

  private async exchangePasswordlessOtp(
    username: string,
    otp: string,
    realm: 'email' | 'sms'
  ): Promise<Auth0TokenResponse> {
    const auth0 = this.configService.get('auth0');
    const clientId = auth0?.clientId || auth0?.managementClientId;
    const clientSecret = auth0?.clientSecret || auth0?.managementClientSecret;
    const audience = auth0?.audience;
    if (!auth0?.domain || !clientId || !clientSecret) {
      throw new Error('Auth0 OTP verification configuration is missing');
    }
    const { data } = await axios.post(`https://${auth0.domain}/oauth/token`, {
      grant_type: 'http://auth0.com/oauth/grant-type/passwordless/otp',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      otp,
      realm,
      audience,
      scope: 'openid profile email offline_access',
    });
    return data;
  }

  async verifyEmailOtp(email: string, otp: string) {
    return this.exchangePasswordlessOtp(email, otp, 'email');
  }

  async verifySmsOtp(phoneNumber: string, otp: string) {
    return this.exchangePasswordlessOtp(phoneNumber, otp, 'sms');
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

  private testUserEmail(identifier: string, isPhone: boolean): string {
    if (!isPhone) return identifier.trim().toLowerCase();
    const config = this.getTestUsersConfig();
    const digits = identifier.replace(/\D/g, '');
    return `${digits}@${config?.emailDomain}`;
  }

  private async ensureTestUser(email: string): Promise<void> {
    const config = this.getTestUsersConfig();
    const client = this.getManagementClient();
    try {
      await client.users.create({
        connection: config!.connection,
        email,
        password: config!.password,
        email_verified: true,
      });
    } catch (error: any) {
      const status = error?.statusCode || error?.response?.status;
      if (status !== 409) {
        throw error;
      }
    }
  }

  private async passwordRealmLogin(
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
      realm: config.connection,
      audience: auth0.audience,
      scope: 'openid profile email offline_access',
    });
    return data;
  }

  async verifyTestUserEmail(email: string): Promise<Auth0TokenResponse> {
    const username = this.testUserEmail(email, false);
    await this.ensureTestUser(username);
    return this.passwordRealmLogin(username);
  }

  async verifyTestUserPhone(phoneNumber: string): Promise<Auth0TokenResponse> {
    const username = this.testUserEmail(phoneNumber, true);
    await this.ensureTestUser(username);
    return this.passwordRealmLogin(username);
  }

  async deleteAuth0User(sub: string): Promise<void> {
    if (!sub?.trim()) {
      throw new Error('Auth0 user id (sub) is required');
    }
    const client = this.getManagementClient();
    await client.users.delete({ id: sub });
  }
}
