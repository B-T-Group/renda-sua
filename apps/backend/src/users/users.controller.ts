import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AddressesService } from '../addresses/addresses.service';
import { AwsService } from '../aws/aws.service';
import { Auth0Service } from '../auth/auth0.service';
import { CurrentUser } from '../auth/user.decorator';
import { Configuration } from '../config/configuration';
import { AgentReferralsService } from '../agents/agent-referrals.service';
import {
  BusinessReferralsService,
  ResolvedBusinessReferral,
} from '../business-referrals/business-referrals.service';
import { BusinessContractsService } from '../business-contracts/business-contracts.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { AccountDeletionService } from './account-deletion.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { RbacService } from '../rbac/rbac.service';
import { derivePersonas, userHasPersona } from './persona.util';
import { isPersonaId, PersonaId } from './persona.types';
import {
  DEFAULT_USER_TIMEZONE,
  isValidIanaTimezone,
} from './user-timezone.util';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';

const PROFILE_PICTURE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const PROFILE_PICTURE_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const GQL_EMAIL_TAKEN_BY_OTHER = `
  query EmailTakenExclude($email: String!, $excludeId: uuid!) {
    users(
      where: {
        _and: [{ email: { _eq: $email } }, { id: { _neq: $excludeId } }]
      }
      limit: 1
    ) {
      id
    }
  }
`;

const GQL_UPDATE_USER_EMAIL = `
  mutation UpdateUserEmail($id: uuid!, $email: String!) {
    update_users_by_pk(
      pk_columns: { id: $id }
      _set: { email: $email, email_verified: false }
    ) {
      id
      email
      first_name
      last_name
      phone_number
      user_type_id
      email_verified
      profile_picture_url
      preferred_language
      timezone
      created_at
      updated_at
    }
  }
`;

const GQL_PHONE_TAKEN_BY_OTHER = `
  query PhoneTakenExclude($phone: String!, $excludeId: uuid!) {
    users(
      where: {
        _and: [{ phone_number: { _eq: $phone } }, { id: { _neq: $excludeId } }]
      }
      limit: 1
    ) {
      id
    }
  }
`;

const GQL_UPDATE_USER_PHONE = `
  mutation UpdateUserPhone($id: uuid!, $phone_number: String!, $phone_number_verified: Boolean!) {
    update_users_by_pk(
      pk_columns: { id: $id }
      _set: { phone_number: $phone_number, phone_number_verified: $phone_number_verified }
    ) {
      id
      email
      first_name
      last_name
      phone_number
      phone_number_verified
      email_verified
      user_type_id
      profile_picture_url
      preferred_language
      timezone
      created_at
      updated_at
    }
  }
`;

@ApiTags('users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly auth0Service: Auth0Service,
    private readonly addressesService: AddressesService,
    private readonly awsService: AwsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly agentReferralsService: AgentReferralsService,
    private readonly businessReferralsService: BusinessReferralsService,
    private readonly accountDeletionService: AccountDeletionService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly businessContractsService: BusinessContractsService,
    private readonly rbacService: RbacService
  ) {}

  private scheduleEnsureContract(businessId: string): void {
    this.businessContractsService
      .ensureContractForBusiness(businessId)
      .catch((error: any) => {
        this.logger.warn(
          `Contract creation for business ${businessId} failed: ${error?.message}`
        );
      });
  }

  @Get('me')
  async getCurrentUser(@ReqContext() ctx: RequestContext, @CurrentUser() auth0User: any) {
    try {
      const user = await this.hasuraUserService.getUser(ctx);
      const country = await this.resolveUserCountry(user);
      const currency = country
        ? await this.addressesService.resolveCurrencyFromCountry(country)
        : 'XAF';
      let personalAccountCreated = false;
      if (country && currency) {
        personalAccountCreated =
          await this.addressesService.ensurePersonalAccount(user.id, currency);
      }
      const isStripeEnabled = country
        ? (await this.paymentRoutingService.resolveRailForCountry(country)) ===
          'stripe'
        : false;

      const access = await this.rbacService.getEffectiveAccess(user.id);

      return {
        success: true,
        user: {
          ...user,
          personas: derivePersonas(user),
          country,
          currency,
          is_stripe_enabled: isStripeEnabled,
          roles: access.roles,
          permissions: access.isSuperuser ? ['*'] : access.permissions,
          is_superuser: access.isSuperuser,
        },
        personalAccountCreated,
        userId: this.hasuraUserService.getUserId(ctx),
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

  /**
   * Resolves the user's ISO alpha-2 country from their primary address (or most
   * recently created address), falling back to their derived persona country.
   */
  private async resolveUserCountry(user: {
    id: string;
    addresses?: Array<{
      country?: string | null;
      is_primary?: boolean | null;
      created_at?: string | null;
    }>;
  }): Promise<string | null> {
    const withCountry = (user.addresses ?? []).filter((a) =>
      a?.country?.trim()
    );
    const primary = withCountry.find((a) => a.is_primary);
    const mostRecent = [...withCountry].sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
    )[0];
    const fromAddress = (primary ?? mostRecent)?.country?.trim();
    if (fromAddress) return fromAddress.toUpperCase();
    const derived = await this.paymentRoutingService.getUserCountryCode(
      user.id
    );
    return derived ? derived.trim().toUpperCase() : null;
  }

  @Post('me/personas/:persona')
  @HttpCode(HttpStatus.OK)
  async addPersona(
    @ReqContext() ctx: RequestContext,
    @Param('persona') personaParam: string,
    @Body()
    body: {
      vehicle_type_id?: string;
      name?: string;
      main_interest?: 'sell_items' | 'rent_items';
      referral_agent_code?: string;
    }
  ) {
    const persona = personaParam?.trim().toLowerCase();
    if (!isPersonaId(persona)) {
      throw new HttpException('Invalid persona', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.ensurePersonaRecord(persona, body, ctx);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { success: false, error: error.message || 'Failed to add persona' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('me/active-persona')
  @HttpCode(HttpStatus.OK)
  async mirrorActivePersona(@ReqContext() ctx: RequestContext, @Body() body: { persona: string }) {
    const p = body?.persona?.trim().toLowerCase();
    if (!isPersonaId(p)) {
      throw new HttpException('Invalid persona', HttpStatus.BAD_REQUEST);
    }
    try {
      const user = await this.hasuraUserService.getUser(ctx);
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

  @Post('me/delete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete the current user account and anonymize personal data' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 409, description: 'Cannot delete (e.g. active orders)' })
  async deleteCurrentUser(@ReqContext() ctx: RequestContext, @CurrentUser() auth0User: any) {
    const auth0Sub = auth0User?.sub?.trim();
    if (!auth0Sub) {
      throw new HttpException(
        { success: false, error: 'Invalid authenticated user' },
        HttpStatus.UNAUTHORIZED
      );
    }
    try {
      const userId = this.hasuraUserService.getUserId(ctx);
      await this.accountDeletionService.deleteAccount(userId, auth0Sub);
      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to delete account',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('me/update')
  async updateCurrentUser(
    @ReqContext() ctx: RequestContext,
    @Body()
    body: {
      firstName: string;
      lastName: string;
      phoneNumber?: string;
      preferredLanguage?: 'en' | 'fr';
      timezone?: string;
    }
  ) {
    try {
      const currentUser = await this.hasuraUserService.getUser(ctx);
      const incomingPhone =
        body.phoneNumber !== undefined
          ? this.normalizePhoneForUpdate(body.phoneNumber)
          : this.normalizePhoneForUpdate(currentUser.phone_number);
      const currentPhone = this.normalizePhoneForUpdate(currentUser.phone_number);
      const phoneChanged =
        body.phoneNumber !== undefined && incomingPhone !== currentPhone;
      if (phoneChanged && currentUser.phone_number_verified === true) {
        throw new HttpException(
          {
            success: false,
            error:
              'Phone number is verified and cannot be changed from profile settings.',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const existingTz = currentUser.timezone ?? DEFAULT_USER_TIMEZONE;
      let timezoneToSave = existingTz;
      if (body.timezone !== undefined) {
        const trimmed = body.timezone.trim();
        if (!isValidIanaTimezone(trimmed)) {
          throw new HttpException(
            {
              success: false,
              error:
                'Invalid timezone. Use an IANA identifier (e.g. Africa/Douala).',
            },
            HttpStatus.BAD_REQUEST
          );
        }
        timezoneToSave = trimmed;
      }
      const mutation = `
        mutation UpdateUser($id: uuid!, $first_name: String!, $last_name: String!, $phone_number: String, $phone_number_verified: Boolean, $preferred_language: String, $timezone: String!) {
          update_users_by_pk(
            pk_columns: { id: $id }
            _set: { first_name: $first_name, last_name: $last_name, phone_number: $phone_number, phone_number_verified: $phone_number_verified, preferred_language: $preferred_language, timezone: $timezone }
          ) {
            id
            email
            first_name
            last_name
            phone_number
            phone_number_verified
            email_verified
            user_type_id
            profile_picture_url
            preferred_language
            timezone
            created_at
            updated_at
          }
        }
      `;
      const result = await this.hasuraUserService.executeMutation(mutation, {
        id: currentUser.id,
        first_name: body.firstName,
        last_name: body.lastName,
        phone_number: incomingPhone || null,
        phone_number_verified: phoneChanged ? false : currentUser.phone_number_verified,
        preferred_language:
          body.preferredLanguage !== undefined
            ? body.preferredLanguage
            : (currentUser as any).preferred_language ?? 'fr',
        timezone: timezoneToSave,
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

  @Post('me/update-email')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set or update the current user email (unverified save)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Email updated' })
  @ApiResponse({ status: 400, description: 'Invalid email' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async updateCurrentUserEmail(@ReqContext() ctx: RequestContext, @Body() body: { email?: string }) {
    try {
      const email = this.normalizeEmailForUpdate(body?.email);
      this.assertValidEmailOrThrow(email);
      const currentUser = await this.hasuraUserService.getUser(ctx);
      if (this.normalizeEmailForUpdate(currentUser.email) === email) {
        return { success: true, user: currentUser };
      }
      if (currentUser.email_verified === true) {
        throw new HttpException(
          {
            success: false,
            error: 'Email is verified and cannot be changed from profile settings.',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      const taken = await this.isEmailTakenByAnotherUser(
        email,
        currentUser.id
      );
      if (taken) {
        throw new HttpException(
          { success: false, error: 'Email is already taken' },
          HttpStatus.CONFLICT
        );
      }
      return await this.persistUserEmail(currentUser.id, email);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to update email',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('me/phone')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Set or update the current user phone number (profile)',
    description:
      'Stores the phone on the user record for payments and notifications. If the number changes, phone_number_verified is reset to false. Verified numbers cannot be changed via this endpoint.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['phoneNumber'],
      properties: { phoneNumber: { type: 'string', description: 'E.164 or normalized string' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Phone updated' })
  @ApiResponse({ status: 400, description: 'Invalid or missing phone, or verified number locked' })
  @ApiResponse({ status: 409, description: 'Phone number already in use by another account' })
  async updateCurrentUserPhone(@ReqContext() ctx: RequestContext, @Body() body: { phoneNumber?: string }) {
    try {
      const phone = this.normalizePhoneForUpdate(body?.phoneNumber);
      if (!phone) {
        throw new HttpException(
          { success: false, error: 'Phone number is required' },
          HttpStatus.BAD_REQUEST
        );
      }
      const currentUser = await this.hasuraUserService.getUser(ctx);
      const currentPhone = this.normalizePhoneForUpdate(currentUser.phone_number);
      const phoneChanged = phone !== currentPhone;
      if (!phoneChanged) {
        return { success: true, user: currentUser };
      }
      if (currentUser.phone_number_verified === true) {
        throw new HttpException(
          {
            success: false,
            error:
              'Phone number is verified and cannot be changed from profile settings.',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      const taken = await this.isPhoneTakenByAnotherUser(phone, currentUser.id);
      if (taken) {
        throw new HttpException(
          { success: false, error: 'Phone number is already in use' },
          HttpStatus.CONFLICT
        );
      }
      return await this.persistUserPhone(currentUser.id, phone, false);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to update phone number',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('profile-picture/presigned-url')
  async getProfilePicturePresignedUrl(
    @ReqContext() ctx: RequestContext,
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

      const user = await this.hasuraUserService.getUser(ctx);
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
    @ReqContext() ctx: RequestContext,
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
            userId: this.hasuraUserService.getUserId(ctx),
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
            userId: this.hasuraUserService.getUserId(ctx),
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
            userId: this.hasuraUserService.getUserId(ctx),
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
    @ReqContext() ctx: RequestContext,
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
        let businessReferral: ResolvedBusinessReferral | null = null;
        if (personas.includes('business')) {
          businessReferral =
            await this.businessReferralsService.resolveBusinessReferralCode(
              userData.referral_agent_code
            );
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
          ...this.businessReferralsService.getBusinessInsertReferralFields(
            businessReferral
          ),
        });
        if (addressData) {
          const uid = inserted.user.id;
          if (inserted.client?.id) {
            await this.addressesService.createAddressForSignup(
              uid,
              inserted.client.id,
              'client',
              addressData
            );
          }
          if (inserted.agent?.id) {
            await this.addressesService.createAddressForSignup(
              uid,
              inserted.agent.id,
              'agent',
              addressData
            );
          }
          if (inserted.business?.id) {
            await this.addressesService.createAddressForSignup(
              uid,
              inserted.business.id,
              'business',
              addressData
            );
          }
        }
        if (inserted.agent?.id) {
          await this.agentReferralsService.creditAgentReferralIfPresent(
            inserted.agent.id,
            userData.referral_agent_code,
            userData.address?.country
          );
        }
        if (inserted.business?.id && businessReferral) {
          await this.businessReferralsService.notifyAgentOfBusinessReferral(
            {
              businessId: inserted.business.id,
              countryCode: userData.address?.country,
              businessName:
                userData.profile?.name?.trim() ||
                `${userData.first_name}'s Business`,
              businessOwnerName:
                `${userData.first_name} ${userData.last_name}`.trim(),
            },
            businessReferral
          );
        }
        if (inserted.business?.id) {
          this.scheduleEnsureContract(inserted.business.id);
        }
        return {
          success: true,
          user: inserted.user,
          client: inserted.client,
          agent: inserted.agent,
          business: inserted.business,
          userId: this.hasuraUserService.getUserId(ctx),
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
        userId: this.hasuraUserService.getUserId(ctx),
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
    if (!userHasPersona(user, p)) {
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
      referral_agent_code?: string;
    }
  ,
    ctx: RequestContext) {
    const uid = this.hasuraUserService.getUserId(ctx);
    const user = await this.hasuraUserService.getUser(ctx);
    if (persona === 'client') {
      if (userHasPersona(user, 'client'))
        return { success: true, client: user.client };
      const source =
        await this.addressesService.resolveSourceAddressForPersonaSeed(
          uid,
          user
        );
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
      if (source) {
        await this.addressesService.seedDefaultAddressForNewPersona(
          uid,
          r.insert_clients_one.id,
          'client',
          source
        );
      }
      return { success: true, client: r.insert_clients_one };
    }
    if (persona === 'agent') {
      if (userHasPersona(user, 'agent'))
        return { success: true, agent: user.agent };
      const source =
        await this.addressesService.resolveSourceAddressForPersonaSeed(
          uid,
          user
        );
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
      if (source) {
        await this.addressesService.seedDefaultAddressForNewPersona(
          uid,
          r.insert_agents_one.id,
          'agent',
          source
        );
      }
      return { success: true, agent: r.insert_agents_one };
    }
    if (persona === 'business') {
      if (userHasPersona(user, 'business'))
        return { success: true, business: user.business };
      const name = body.name?.trim();
      if (!name) {
        throw new HttpException(
          'Business name is required',
          HttpStatus.BAD_REQUEST
        );
      }
      const source =
        await this.addressesService.resolveSourceAddressForPersonaSeed(
          uid,
          user
        );
      const mi = body.main_interest ?? 'sell_items';
      if (mi !== 'sell_items' && mi !== 'rent_items') {
        throw new HttpException('Invalid main_interest', HttpStatus.BAD_REQUEST);
      }
      const businessReferral =
        await this.businessReferralsService.resolveBusinessReferralCode(
          body.referral_agent_code,
          uid
        );
      const referralFields =
        this.businessReferralsService.getBusinessInsertReferralFields(
          businessReferral
        );
      const hasReferral = Boolean(referralFields.business_referral_agent_id);
      const r = await this.hasuraSystemService.executeMutation<{
        insert_businesses_one: { id: string };
      }>(
        hasReferral
          ? `
        mutation AddBusiness(
          $userId: uuid!
          $name: String!
          $mi: business_main_interest_enum!
          $agentId: uuid!
          $referralCode: String!
        ) {
          insert_businesses_one(object: {
            user_id: $userId
            name: $name
            main_interest: $mi
            referred_by_agent_id: $agentId
            referral_code_used: $referralCode
          }) {
            id
            user_id
            name
            main_interest
            created_at
            updated_at
          }
        }
      `
          : `
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
        hasReferral
          ? {
              userId: uid,
              name,
              mi,
              agentId: referralFields.business_referral_agent_id,
              referralCode: referralFields.business_referral_code_used,
            }
          : { userId: uid, name, mi }
      );
      if (source) {
        await this.addressesService.seedDefaultAddressForNewPersona(
          uid,
          r.insert_businesses_one.id,
          'business',
          source,
          name
        );
      }
      const countryCode = await this.resolveUserCountry(user);
      if (businessReferral) {
        await this.businessReferralsService.notifyAgentOfBusinessReferral(
          {
            businessId: r.insert_businesses_one.id,
            countryCode: source?.country ?? countryCode ?? undefined,
            businessName: name,
            businessOwnerName:
              `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
          },
          businessReferral
        );
      }
      this.scheduleEnsureContract(r.insert_businesses_one.id);
      return { success: true, business: r.insert_businesses_one };
    }
    throw new HttpException('Invalid persona', HttpStatus.BAD_REQUEST);
  }

  private normalizeEmailForUpdate(raw?: string | null): string {
    return String(raw || '')
      .trim()
      .toLowerCase();
  }

  private normalizePhoneForUpdate(raw?: string | null): string {
    return String(raw || '').trim();
  }

  private assertValidEmailOrThrow(email: string): void {
    if (!email) {
      throw new HttpException(
        { success: false, error: 'Email is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
      throw new HttpException(
        { success: false, error: 'Invalid email address' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async isEmailTakenByAnotherUser(
    email: string,
    excludeUserId: string
  ): Promise<boolean> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(GQL_EMAIL_TAKEN_BY_OTHER, { email, excludeId: excludeUserId });
    return (result.users?.length || 0) > 0;
  }

  private async isPhoneTakenByAnotherUser(
    phone: string,
    excludeUserId: string
  ): Promise<boolean> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(GQL_PHONE_TAKEN_BY_OTHER, { phone, excludeId: excludeUserId });
    return (result.users?.length || 0) > 0;
  }

  private async persistUserPhone(
    userId: string,
    phone: string,
    phoneVerified: boolean
  ) {
    const result = await this.hasuraUserService.executeMutation<{
      update_users_by_pk: Record<string, unknown>;
    }>(GQL_UPDATE_USER_PHONE, {
      id: userId,
      phone_number: phone,
      phone_number_verified: phoneVerified,
    });
    return { success: true, user: result.update_users_by_pk };
  }

  private async persistUserEmail(userId: string, email: string) {
    const result = await this.hasuraUserService.executeMutation<{
      update_users_by_pk: Record<string, unknown>;
    }>(GQL_UPDATE_USER_EMAIL, { id: userId, email });
    return { success: true, user: result.update_users_by_pk };
  }
}
