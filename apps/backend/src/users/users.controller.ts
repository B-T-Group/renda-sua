import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressesService } from '../addresses/addresses.service';
import { AwsService } from '../aws/aws.service';
import { Auth0Service } from '../auth/auth0.service';
import { CurrentUser } from '../auth/user.decorator';
import { Configuration } from '../config/configuration';
import { AgentReferralsService } from '../agents/agent-referrals.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { derivePersonas } from './persona.util';
import { isPersonaId, PersonaId } from './persona.types';

const PROFILE_PICTURE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const PROFILE_PICTURE_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

@Controller('users')
export class UsersController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly auth0Service: Auth0Service,
    private readonly addressesService: AddressesService,
    private readonly awsService: AwsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly agentReferralsService: AgentReferralsService
  ) {}

  @Get('me')
  async getCurrentUser(@CurrentUser() auth0User: any) {
    try {
      const user = await this.hasuraUserService.getUser();

      return {
        success: true,
        user: { ...user, personas: derivePersonas(user) },
        userId: this.hasuraUserService.getUserId(),
        auth0User: {
          sub: auth0User.sub,
          email: auth0User.email,
          email_verified: auth0User.email_verified,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Post('me/personas/:persona')
  @HttpCode(HttpStatus.OK)
  async addPersona(
    @Param('persona') personaParam: string,
    @Body()
    body: {
      vehicle_type_id?: string;
      name?: string;
      main_interest?: 'sell_items' | 'rent_items';
    }
  ) {
    const persona = personaParam?.trim().toLowerCase();
    if (!isPersonaId(persona)) {
      throw new HttpException('Invalid persona', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.ensurePersonaRecord(persona, body);
    } catch (error: any) {
      throw new HttpException(
        { success: false, error: error.message || 'Failed to add persona' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('me/active-persona')
  @HttpCode(HttpStatus.OK)
  async mirrorActivePersona(@Body() body: { persona: string }) {
    const p = body?.persona?.trim().toLowerCase();
    if (!isPersonaId(p)) {
      throw new HttpException('Invalid persona', HttpStatus.BAD_REQUEST);
    }
    try {
      const user = await this.hasuraUserService.getUser();
      this.assertUserHasPersona(user, p);
      await this.hasuraSystemService.executeMutation(
        `
        mutation MirrorUserType($id: uuid!, $t: user_types_enum!) {
          update_users_by_pk(pk_columns: { id: $id }, _set: { user_type_id: $t }) {
            id
            user_type_id
          }
        }
      `,
        { id: user.id, t: p }
      );
      return { success: true, persona: p };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: error.message || 'Failed to update persona' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('me/update')
  async updateCurrentUser(
    @Body()
    body: {
      firstName: string;
      lastName: string;
      phoneNumber?: string;
      preferredLanguage?: 'en' | 'fr';
    }
  ) {
    try {
      const currentUser = await this.hasuraUserService.getUser();
      const mutation = `
        mutation UpdateUser($id: uuid!, $first_name: String!, $last_name: String!, $phone_number: String, $preferred_language: String) {
          update_users_by_pk(
            pk_columns: { id: $id }
            _set: { first_name: $first_name, last_name: $last_name, phone_number: $phone_number, preferred_language: $preferred_language }
          ) {
            id
            email
            first_name
            last_name
            phone_number
            user_type_id
            profile_picture_url
            preferred_language
            created_at
            updated_at
          }
        }
      `;
      const result = await this.hasuraUserService.executeMutation(mutation, {
        id: currentUser.id,
        first_name: body.firstName,
        last_name: body.lastName,
        phone_number: body.phoneNumber ?? null,
        preferred_language:
          body.preferredLanguage !== undefined
            ? body.preferredLanguage
            : (currentUser as any).preferred_language ?? 'fr',
      });
      return {
        success: true,
        user: result.update_users_by_pk,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to update user profile',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('profile-picture/presigned-url')
  async getProfilePicturePresignedUrl(
    @Body()
    body: { contentType: string; fileName: string; fileSize?: number }
  ) {
    try {
      const { contentType, fileName, fileSize } = body;
      if (!contentType || !fileName) {
        throw new HttpException(
          {
            success: false,
            error: 'contentType and fileName are required',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      if (!PROFILE_PICTURE_ACCEPTED_TYPES.includes(contentType)) {
        throw new HttpException(
          {
            success: false,
            error: 'Invalid file type. Allowed: jpeg, jpg, png, webp',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      if (fileSize != null && fileSize > PROFILE_PICTURE_MAX_SIZE) {
        throw new HttpException(
          {
            success: false,
            error: 'File size exceeds maximum allowed (5MB)',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const user = await this.hasuraUserService.getUser();
      const ext =
        fileName.split('.').pop()?.toLowerCase() ||
        (contentType === 'image/jpeg' || contentType === 'image/jpg'
          ? 'jpg'
          : contentType === 'image/png'
            ? 'png'
            : contentType === 'image/webp'
              ? 'webp'
              : 'jpg');
      const key = `users/${user.id}/profile_picture.${ext}`;

      const awsConfig = this.configService.get('aws');
      const bucketName =
        awsConfig?.s3BucketName || process.env.S3_BUCKET_NAME || 'rendasua-uploads';
      const region =
        awsConfig?.s3BucketRegion ||
        awsConfig?.region ||
        process.env.S3_BUCKET_REGION ||
        'ca-central-1';

      const { url, expiresAt } = await this.awsService.generateImageUploadUrl(
        bucketName,
        key,
        contentType,
        3600
      );

      const finalUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

      return {
        success: true,
        presigned_url: url,
        key,
        final_url: finalUrl,
        expires_at: expiresAt,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to generate presigned URL',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('pending_orders')
  async getPendingOrders() {
    try {
      const query = `
        query GetPendingOrders {
          orders(where: { current_status: { _eq: "pending" } }) {
            id
            order_number
            client_id
            business_id
            business_location_id
            assigned_agent_id
            delivery_address_id
            subtotal
            delivery_fee
            tax_amount
            total_amount
            currency
            current_status
            estimated_delivery_time
            actual_delivery_time
            special_instructions
            preferred_delivery_time
            payment_method
            payment_status
            created_at
            updated_at
            client {
              id
              user {
                id
                first_name
                last_name
                email
              }
            }
            business {
              id
              name
              user {
                id
                first_name
                last_name
              }
            }
            business_location {
              id
              name
              location_type
              address {
                id
                address_line_1
                address_line_2
                city
                state
                postal_code
                country
              }
            }
            delivery_address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
            }
            order_items {
              id
              item_name
              item_description
              unit_price
              quantity
              total_price
              special_instructions
            }
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query);

      return {
        success: true,
        orders: result.orders,
        count: result.orders.length,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch pending orders',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('profile')
  async createUserProfile(
    @Body()
    profileData: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      userType: string;
      businessName?: string;
      /** sell_items | rent_items — defaults to sell_items for business */
      mainInterest?: 'sell_items' | 'rent_items';
      address?: string;
      vehicleTypeId?: string;
    }
  ) {
    try {
      // Map frontend user types to backend user type IDs (these should match the enum values)
      const userTypeMap: { [key: string]: string } = {
        client: 'client',
        agent: 'agent',
        business: 'business',
      };

      const userTypeId = userTypeMap[profileData.userType];
      if (!userTypeId) {
        throw new Error('Invalid user type');
      }

      let result: any;

      switch (userTypeId) {
        case 'client':
          result = await this.hasuraSystemService.createUserWithClient({
            email: profileData.email,
            first_name: profileData.firstName,
            last_name: profileData.lastName,
            phone_number: profileData.phone,
            user_type_id: userTypeId,
          });
          return {
            success: true,
            user: result.user,
            client: result.client,
            userId: this.hasuraUserService.getUserId(),
          };

        case 'agent':
          result = await this.hasuraSystemService.createUserWithAgent(
            {
              email: profileData.email,
              first_name: profileData.firstName,
              last_name: profileData.lastName,
              phone_number: profileData.phone,
              user_type_id: userTypeId,
            },
            {
              vehicle_type_id: profileData.vehicleTypeId || 'other',
            }
          );
          return {
            success: true,
            user: result.user,
            agent: result.agent,
            userId: this.hasuraUserService.getUserId(),
          };

        case 'business':
          if (!profileData.businessName) {
            throw new Error('Business name is required for business users');
          }
          result = await this.hasuraSystemService.createUserWithBusiness(
            {
              email: profileData.email,
              first_name: profileData.firstName,
              last_name: profileData.lastName,
              phone_number: profileData.phone,
              user_type_id: userTypeId,
            },
            {
              name: profileData.businessName,
              main_interest: profileData.mainInterest ?? 'sell_items',
            }
          );
          return {
            success: true,
            user: result.user,
            business: result.business,
            userId: this.hasuraUserService.getUserId(),
          };

        default:
          throw new Error('Invalid user type');
      }
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('resend_verification')
  @HttpCode(202)
  async resendVerification(@CurrentUser() auth0User: any) {
    try {
      const userId = auth0User?.sub;
      if (!userId) {
        throw new Error('Invalid current user');
      }
      await this.auth0Service.resendVerificationEmail(userId);
      return { success: true };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to resend verification email',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  async createUser(
    @Body()
    userData: {
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
      user_type_id: string;
      personas?: PersonaId[];
      profile: {
        vehicle_type_id?: string;
        name?: string;
        main_interest?: 'sell_items' | 'rent_items';
      };
      address?: {
        address_line_1: string;
        country: string;
        city: string;
        state: string;
      };
      referral_agent_code?: string;
    }
  ) {
    try {
      const personas = this.normalizeCreateUserPersonas(userData);
      const wantsAddress = personas.some((p) =>
        ['client', 'agent', 'business'].includes(p)
      );
      const addressData =
        userData.address && wantsAddress
          ? {
              address_line_1: userData.address.address_line_1,
              country: userData.address.country,
              city: userData.address.city,
              state: userData.address.state,
            }
          : null;

      if (wantsAddress && !addressData) {
        throw new Error('address is required for client, agent, and business');
      }

      if (personas.length > 0) {
        const mi = userData.profile?.main_interest ?? 'sell_items';
        if (mi !== 'sell_items' && mi !== 'rent_items') {
          throw new Error('main_interest must be sell_items or rent_items');
        }
        const inserted = await this.hasuraSystemService.insertUserWithPersonas({
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone_number: userData.phone_number ?? null,
          email_verified: false,
          personas,
          vehicle_type_id: userData.profile?.vehicle_type_id,
          business_name:
            userData.profile?.name?.trim() ||
            `${userData.first_name}'s Business`,
          main_interest: mi,
        });
        if (addressData) {
          if (inserted.client?.id) {
            await this.addressesService.createAddressForSignup(
              inserted.client.id,
              'client',
              addressData
            );
          }
          if (inserted.agent?.id) {
            await this.addressesService.createAddressForSignup(
              inserted.agent.id,
              'agent',
              addressData
            );
          }
          if (inserted.business?.id) {
            await this.addressesService.createAddressForSignup(
              inserted.business.id,
              'business',
              addressData
            );
          }
        }
        if (inserted.agent?.id) {
          await this.handleAgentReferralIfPresent(
            inserted.agent.id,
            userData.referral_agent_code,
            userData.address?.country
          );
        }
        return {
          success: true,
          user: inserted.user,
          client: inserted.client,
          agent: inserted.agent,
          business: inserted.business,
          userId: this.hasuraUserService.getUserId(),
        };
      }

      const user = await this.hasuraSystemService.createUser({
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone_number: userData.phone_number,
        user_type_id: userData.user_type_id,
      });
      return {
        success: true,
        user,
        userId: this.hasuraUserService.getUserId(),
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private normalizeCreateUserPersonas(userData: {
    personas?: PersonaId[];
    user_type_id: string;
  }): PersonaId[] {
    if (userData.personas?.length) {
      const unique = [...new Set(userData.personas)];
      if (!unique.every(isPersonaId)) {
        throw new Error('Invalid personas');
      }
      return unique;
    }
    if (
      userData.user_type_id &&
      ['client', 'agent', 'business'].includes(userData.user_type_id)
    ) {
      return [userData.user_type_id as PersonaId];
    }
    return [];
  }

  private assertUserHasPersona(user: any, p: PersonaId) {
    const has =
      (p === 'client' && user.client) ||
      (p === 'agent' && user.agent) ||
      (p === 'business' && user.business);
    if (!has) {
      throw new HttpException(
        'Persona is not enabled for this account',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async ensurePersonaRecord(
    persona: PersonaId,
    body: {
      vehicle_type_id?: string;
      name?: string;
      main_interest?: 'sell_items' | 'rent_items';
    }
  ) {
    const uid = this.hasuraUserService.getUserId();
    const user = await this.hasuraUserService.getUser();
    if (persona === 'client') {
      if (user.client) return { success: true, client: user.client };
      const r = await this.hasuraSystemService.executeMutation<{
        insert_clients_one: { id: string };
      }>(
        `
        mutation AddClient($userId: uuid!) {
          insert_clients_one(object: { user_id: $userId }) {
            id
            user_id
            created_at
            updated_at
          }
        }
      `,
        { userId: uid }
      );
      return { success: true, client: r.insert_clients_one };
    }
    if (persona === 'agent') {
      if (user.agent) return { success: true, agent: user.agent };
      const vt = body.vehicle_type_id || 'other';
      const r = await this.hasuraSystemService.executeMutation<{
        insert_agents_one: { id: string };
      }>(
        `
        mutation AddAgent($userId: uuid!, $vt: vehicle_types_enum!) {
          insert_agents_one(object: { user_id: $userId, vehicle_type_id: $vt }) {
            id
            user_id
            vehicle_type_id
            created_at
            updated_at
          }
        }
      `,
        { userId: uid, vt }
      );
      return { success: true, agent: r.insert_agents_one };
    }
    if (persona === 'business') {
      if (user.business) return { success: true, business: user.business };
      const name = body.name?.trim();
      if (!name) {
        throw new HttpException(
          'Business name is required',
          HttpStatus.BAD_REQUEST
        );
      }
      const mi = body.main_interest ?? 'sell_items';
      if (mi !== 'sell_items' && mi !== 'rent_items') {
        throw new HttpException('Invalid main_interest', HttpStatus.BAD_REQUEST);
      }
      const r = await this.hasuraSystemService.executeMutation<{
        insert_businesses_one: { id: string };
      }>(
        `
        mutation AddBusiness($userId: uuid!, $name: String!, $mi: business_main_interest_enum!) {
          insert_businesses_one(object: { user_id: $userId, name: $name, main_interest: $mi }) {
            id
            user_id
            name
            main_interest
            created_at
            updated_at
          }
        }
      `,
        { userId: uid, name, mi }
      );
      return { success: true, business: r.insert_businesses_one };
    }
    throw new HttpException('Invalid persona', HttpStatus.BAD_REQUEST);
  }

  private async handleAgentReferralIfPresent(
    newAgentId: string,
    referralAgentCode?: string,
    countryCode?: string
  ): Promise<void> {
    const normalizedCode = referralAgentCode?.trim();
    if (!normalizedCode || !countryCode) {
      return;
    }

    const referringAgent = await this.agentReferralsService.findAgentByCode(
      normalizedCode
    );
    if (!referringAgent) {
      return;
    }

    await this.agentReferralsService.creditReferral(
      referringAgent.agentId,
      newAgentId,
      countryCode,
      normalizedCode
    );
  }
}
