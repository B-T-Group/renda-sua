import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      scope:
        'read:users update:users update:users_app_metadata create:users_jobs',
    });

    return this.managementClient;
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const client = this.getManagementClient();
    await client.jobs.sendEmailVerification({ user_id: userId });
  }
}
