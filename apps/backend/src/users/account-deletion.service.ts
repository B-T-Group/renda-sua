import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Auth0Service } from '../auth/auth0.service';
import { AwsService } from '../aws/aws.service';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  DELETED_BUSINESS_DISPLAY_NAME,
  DELETED_USER_DISPLAY_NAME,
  TERMINAL_ORDER_STATUSES,
} from './account-deletion.constants';

const USER_UPLOADS_BUCKET = 'rendasua-user-uploads';

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly awsService: AwsService,
    private readonly auth0Service: Auth0Service,
    private readonly configService: ConfigService<Configuration>
  ) {}

  async deleteAccount(userId: string, auth0Sub: string): Promise<void> {
    const user = await this.hasuraSystemService.getUserByIdWithRelations(userId);
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (user.account_status === 'deleted') {
      throw new ConflictException({
        success: false,
        error: 'Account is already deleted',
      });
    }
    await this.assertNoOpenOrders(userId, user);
    await this.deleteProfilePictureFromS3(userId, user.profile_picture_url);
    await this.deleteUserUploads(userId);
    await this.anonymizeAddresses(userId);
    await this.anonymizeUserRow(userId);
    await this.anonymizeBusinessName(user.business?.id);
    await this.deletePushToken(userId);
    await this.deleteAgentLocations(user.agent?.id);
    await this.auth0Service.deleteAuth0User(auth0Sub);
  }

  private async assertNoOpenOrders(userId: string, user: any): Promise<void> {
    const orFilters: Record<string, unknown>[] = [];
    if (user.client?.id) {
      orFilters.push({ client: { user_id: { _eq: userId } } });
    }
    if (user.business?.id) {
      orFilters.push({ business: { user_id: { _eq: userId } } });
    }
    if (user.agent?.id) {
      orFilters.push({ assigned_agent: { user_id: { _eq: userId } } });
    }
    if (orFilters.length === 0) return;

    const result = await this.hasuraSystemService.executeQuery<{
      orders_aggregate: { aggregate: { count: number } | null };
    }>(
      `
      query OpenOrdersForUser($or: [orders_bool_exp!]!, $terminal: [order_status!]!) {
        orders_aggregate(
          where: {
            _and: [{ _or: $or }, { current_status: { _nin: $terminal } }]
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `,
      { or: orFilters, terminal: [...TERMINAL_ORDER_STATUSES] }
    );
    const count = result.orders_aggregate?.aggregate?.count ?? 0;
    if (count > 0) {
      throw new ConflictException({
        success: false,
        error:
          'You have active orders in progress. Complete or cancel them before deleting your account.',
      });
    }
  }

  private async deleteProfilePictureFromS3(
    userId: string,
    profilePictureUrl?: string | null
  ): Promise<void> {
    const keys = this.profilePictureKeys(userId, profilePictureUrl);
    for (const key of keys) {
      try {
        await this.awsService.deleteObject(this.getUploadsBucket(), key);
      } catch (error: any) {
        this.logger.warn(`Profile picture S3 delete failed for ${key}`, error?.message);
      }
    }
  }

  private profilePictureKeys(
    userId: string,
    profilePictureUrl?: string | null
  ): string[] {
    const keys = new Set<string>();
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      keys.add(`users/${userId}/profile_picture.${ext}`);
    }
    if (profilePictureUrl) {
      const parsed = this.s3KeyFromUrl(profilePictureUrl);
      if (parsed) keys.add(parsed);
    }
    return [...keys];
  }

  private s3KeyFromUrl(url: string): string | null {
    try {
      const path = new URL(url).pathname.replace(/^\//, '');
      return path || null;
    } catch {
      return null;
    }
  }

  private getUploadsBucket(): string {
    const awsConfig = this.configService.get('aws');
    return awsConfig?.s3BucketName || process.env.S3_BUCKET_NAME || 'rendasua-uploads';
  }

  private async deleteUserUploads(userId: string): Promise<void> {
    const result = await this.hasuraSystemService.executeQuery<{
      user_uploads: Array<{ id: string; key: string }>;
    }>(
      `
      query UserUploadsForDeletion($userId: uuid!) {
        user_uploads(where: { user_id: { _eq: $userId } }) {
          id
          key
        }
      }
    `,
      { userId }
    );
    for (const upload of result.user_uploads ?? []) {
      try {
        await this.awsService.deleteObject(USER_UPLOADS_BUCKET, upload.key);
      } catch (error: any) {
        this.logger.warn(`Upload S3 delete failed: ${upload.id}`, error?.message);
      }
      await this.hasuraSystemService.executeMutation(
        `mutation ($id: uuid!) { delete_user_uploads_by_pk(id: $id) { id } }`,
        { id: upload.id }
      );
    }
  }

  private async anonymizeAddresses(userId: string): Promise<void> {
    const result = await this.hasuraSystemService.executeQuery<{
      ca: Array<{ address_id: string }>;
      aa: Array<{ address_id: string }>;
      ba: Array<{ address_id: string }>;
    }>(
      `
      query AddressIdsForUser($uid: uuid!) {
        ca: client_addresses(where: { client: { user_id: { _eq: $uid } } }) {
          address_id
        }
        aa: agent_addresses(where: { agent: { user_id: { _eq: $uid } } }) {
          address_id
        }
        ba: business_addresses(where: { business: { user_id: { _eq: $uid } } }) {
          address_id
        }
      }
    `,
      { uid: userId }
    );
    const ids = [
      ...(result.ca ?? []).map((r) => r.address_id),
      ...(result.aa ?? []).map((r) => r.address_id),
      ...(result.ba ?? []).map((r) => r.address_id),
    ];
    const unique = [...new Set(ids)];
    for (const addressId of unique) {
      await this.hasuraSystemService.executeMutation(
        `
        mutation ($id: uuid!) {
          update_addresses_by_pk(
            pk_columns: { id: $id }
            _set: {
              status: deleted
              address_line_1: ""
              address_line_2: ""
              city: ""
              state: ""
              postal_code: ""
              instructions: null
            }
          ) {
            id
          }
        }
      `,
        { id: addressId }
      );
    }
  }

  private async anonymizeUserRow(userId: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation (
        $id: uuid!
        $firstName: String!
        $lastName: String!
        $deletedAt: timestamptz!
      ) {
        update_users_by_pk(
          pk_columns: { id: $id }
          _set: {
            first_name: $firstName
            last_name: $lastName
            email: null
            phone_number: null
            profile_picture_url: null
            email_verified: false
            phone_number_verified: false
            account_status: deleted
            deleted_at: $deletedAt
          }
        ) {
          id
        }
      }
    `,
      {
        id: userId,
        firstName: DELETED_USER_DISPLAY_NAME,
        lastName: DELETED_USER_DISPLAY_NAME,
        deletedAt: new Date().toISOString(),
      }
    );
  }

  private async anonymizeBusinessName(businessId?: string): Promise<void> {
    if (!businessId) return;
    await this.hasuraSystemService.executeMutation(
      `
      mutation ($id: uuid!, $name: String!) {
        update_businesses_by_pk(pk_columns: { id: $id }, _set: { name: $name }) {
          id
        }
      }
    `,
      { id: businessId, name: DELETED_BUSINESS_DISPLAY_NAME }
    );
  }

  private async deletePushToken(userId: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation ($userId: uuid!) {
        delete_mobile_push_tokens(where: { user_id: { _eq: $userId } }) {
          affected_rows
        }
      }
    `,
      { userId }
    );
  }

  private async deleteAgentLocations(agentId?: string): Promise<void> {
    if (!agentId) return;
    await this.hasuraSystemService.executeMutation(
      `
      mutation ($agentId: uuid!) {
        delete_agent_locations(where: { agent_id: { _eq: $agentId } }) {
          affected_rows
        }
      }
    `,
      { agentId }
    );
  }
}
