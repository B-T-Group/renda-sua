import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ManagementClient } from 'auth0';
import { Configuration } from '../config/configuration';

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

  async startEmailOtp(email: string): Promise<void> {
    const auth0 = this.configService.get('auth0');
    const clientId = auth0?.clientId || auth0?.managementClientId;
    if (!auth0?.domain || !clientId) {
      throw new Error('Auth0 passwordless configuration is missing');
    }
    await axios.post(`https://${auth0.domain}/passwordless/start`, {
      client_id: clientId,
      connection: 'email',
      email,
      send: 'code',
    });
  }

  async verifyEmailOtp(email: string, otp: string): Promise<{
    access_token: string;
    id_token?: string;
    token_type: string;
    expires_in: number;
  }> {
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
      username: email,
      otp,
      realm: 'email',
      audience,
      scope: 'openid profile email',
    });
    return data;
  }
}
