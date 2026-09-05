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
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import {
  AddressResponse,
  AddressesService,
} from '../addresses/addresses.service';
import { AwsService } from '../aws/aws.service';
import { Auth0Service } from '../auth/auth0.service';
import { CurrentUser } from '../auth/user.decorator';
import { Public } from '../auth/public.decorator';
import { Configuration } from '../config/configuration';
import { AgentReferralsService } from '../agents/agent-referrals.service';
import {
  BusinessReferralsService,
  ResolvedBusinessReferral,
} from '../business-referrals/business-referrals.service';
import { CreditsService } from '../credits/credits.service';
import { BusinessContractsService } from '../business-contracts/business-contracts.service';
import { LaunchPromoService } from '../launch-promo/launch-promo.service';
import { MobilePaymentPhoneSeedService } from '../mobile-payment-phones/mobile-payment-phone-seed.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { AccountDeletionService } from './account-deletion.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { RbacService } from '../rbac/rbac.service';
import {
  derivePersonas,
  resolveSessionPersona,
  userHasPersona,
  type UserPersonaShape,
} from './persona.util';
import { isPersonaId, PersonaId } from './persona.types';
import {
  DEFAULT_USER_TIMEZONE,
  isValidIanaTimezone,
} from './user-timezone.util';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { DelegationAccessService } from '../delegations/delegation-access.service';
import { LocationDelegationsFlagService } from '../delegations/location-delegations-flag.service';
import { SetActiveContextDto } from '../delegations/dto/set-active-context.dto';
import type { DelegationGrant } from '../delegations/delegation.types';

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
    private readonly creditsService: CreditsService,
    private readonly accountDeletionService: AccountDeletionService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly businessContractsService: BusinessContractsService,
    private readonly rbacService: RbacService,
    private readonly mobilePaymentPhoneSeedService: MobilePaymentPhoneSeedService,
    private readonly launchPromoService: LaunchPromoService,
    private readonly locationDelegationsFlag: LocationDelegationsFlagService,
    private readonly delegationAccess: DelegationAccessService
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

  private async awardReferralOpsCredit(
    referral: ResolvedBusinessReferral,
    target: { kind: 'business' | 'agent'; id: string }
  ): Promise<void> {
    try {
      const referrerUserId = await this.creditsService.resolveReferrerUserId({
        kind: referral.kind,
        agentId: referral.kind === 'agent' ? referral.agentId : undefined,
        businessUserId:
          referral.kind === 'business' ? referral.userId : undefined,
      });
      if (!referrerUserId) return;
      if (target.kind === 'business') {
        await this.creditsService.awardBusinessReferred({
          referrerUserId,
          businessId: target.id,
        });
        return;
      }
      await this.creditsService.awardAgentReferred({
        referrerUserId,
        agentId: target.id,
      });
    } catch (error: any) {
      this.logger.warn(`Referral credit award failed: ${error?.message}`);
    }
  }

  /**
   * After Auth0 Universal Login (email or SMS OTP), first authenticated /me for a
   * still-unverified business sends BoldSign, then persists verification flags.
   * Flags are written only after ensure succeeds so a failed send can retry.
   */
  private async syncVerificationAndContractAfterAuth(
    user: {
      id: string;
      email?: string | null;
      phone_number?: string | null;
      email_verified?: boolean | null;
      phone_number_verified?: boolean | null;
      business?: { id?: string } | null;
    },
    auth0Sub?: string
  ): Promise<boolean> {
    const businessId = user.business?.id;
    if (!businessId) return false;
    if (user.email_verified === true || user.phone_number_verified === true) {
      return false;
    }
    try {
      await this.businessContractsService.ensureContractForBusiness(businessId);
    } catch (error: any) {
      this.logger.warn(
        `Contract after Auth0 login failed for ${businessId}: ${error?.message}`
      );
      return false;
    }
    return this.markSignupVerifiedInDb(user, auth0Sub);
  }

  private verifiedFlagsForAuthChannel(
    user: { email?: string | null; phone_number?: string | null },
    auth0Sub?: string
  ): Record<string, boolean> {
    const set: Record<string, boolean> = {};
    const sub = auth0Sub || '';
    if (sub.startsWith('sms|') && user.phone_number) {
      set.phone_number_verified = true;
      return set;
    }
    if (user.email) set.email_verified = true;
    else if (user.phone_number) set.phone_number_verified = true;
    return set;
  }

  private async markSignupVerifiedInDb(
    user: { id: string; email?: string | null; phone_number?: string | null },
    auth0Sub?: string
  ): Promise<boolean> {
    const set = this.verifiedFlagsForAuthChannel(user, auth0Sub);
    if (!Object.keys(set).length) return false;
    try {
      await this.hasuraSystemService.executeMutation(
        `
        mutation MarkSignupVerified($id: uuid!, $set: users_set_input!) {
          update_users_by_pk(pk_columns: { id: $id }, _set: $set) { id }
        }
      `,
        { id: user.id, set }
      );
      return true;
    } catch (error: any) {
      this.logger.warn(
        `Failed to mark signup verified for ${user.id}: ${error?.message}`
      );
      return false;
    }
  }

  @Public()
  @Get('public/by-referral-code/:code')
  @ApiOperation({
    summary: 'Look up a user by referral code (public)',
    description:
      'Returns the display name for a user-level referral code. Falls back to legacy agent/business codes.',
  })
  @ApiParam({
    name: 'code',
    description: '6-character alphanumeric referral code',
    example: 'AB12CD',
  })
  @ApiResponse({ status: 200, description: 'Referrer found' })
  @ApiResponse({ status: 404, description: 'No referrer found' })
  async getPublicByReferralCode(@Param('code') code: string) {
    const normalized =
      this.businessReferralsService.normalizeReferralCode(code);
    if (!normalized) {
      throw new HttpException(
        { success: false, error: 'Invalid referral code format' },
        HttpStatus.BAD_REQUEST
      );
    }

    const user =
      await this.businessReferralsService.findUserByReferralCode(normalized);
    if (user) {
      const canRefer = await this.businessReferralsService.userCanRefer(
        user.userId
      );
      if (canRefer) {
        const fullName =
          `${user.userFirstName} ${user.userLastName}`.trim() ||
          user.userFirstName;
        return {
          success: true,
          referralCode: normalized,
          fullName,
          firstName: user.userFirstName,
          kind: 'user' as const,
        };
      }
    }

    const agent =
      await this.agentReferralsService.findAgentByCode(normalized);
    if (agent?.status === 'active') {
      const fullName =
        `${agent.userFirstName} ${agent.userLastName}`.trim();
      return {
        success: true,
        referralCode: normalized,
        fullName,
        firstName: agent.userFirstName,
        kind: 'agent' as const,
      };
    }

    const business =
      await this.businessReferralsService.findBusinessByCode(normalized);
    if (business && business.lifecycleStatus !== 'suspended') {
      return {
        success: true,
        referralCode: normalized,
        fullName: business.businessName,
        firstName: business.userFirstName,
        kind: 'business' as const,
      };
    }

    throw new HttpException(
      { success: false, error: 'No referrer found for this referral code' },
      HttpStatus.NOT_FOUND
    );
  }

  @Get('me')
  async getCurrentUser(@ReqContext() ctx: RequestContext, @CurrentUser() auth0User: any) {
    try {
      if (await this.locationDelegationsFlag.isEnabled()) {
        return this.getCurrentUserWithDelegations(ctx, auth0User);
      }
      const user = await this.hasuraUserService.getUser(ctx);
      const verifiedViaAuthSession =
        await this.syncVerificationAndContractAfterAuth(user, auth0User?.sub);
      const verifiedFlags = verifiedViaAuthSession
        ? this.verifiedFlagsForAuthChannel(user, auth0User?.sub)
        : {};
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
        active_persona: user.active_persona,
        user: {
          ...user,
          email_verified:
            verifiedFlags.email_verified === true
              ? true
              : user.email_verified,
          phone_number_verified:
            verifiedFlags.phone_number_verified === true
              ? true
              : user.phone_number_verified,
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

  @Post('me/active-context')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate and echo the active session context' })
  async setActiveContext(
    @ReqContext() ctx: RequestContext,
    @Body() body: SetActiveContextDto
  ) {
    if (!(await this.locationDelegationsFlag.isEnabled())) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (body.kind === 'persona') {
      return this.mirrorActivePersona(ctx, { persona: body.persona || '' });
    }
    if (body.kind !== 'delegation' || !body.delegationId) {
      throw new HttpException('Invalid context', HttpStatus.BAD_REQUEST);
    }
    const userId = this.hasuraUserService.getUserId(ctx);
    await this.delegationAccess.resolve(userId, body.delegationId);
    return { success: true, kind: 'delegation', delegationId: body.delegationId };
  }

  private async getCurrentUserWithDelegations(
    ctx: RequestContext,
    auth0User: any
  ) {
    const identity = await this.hasuraUserService.getUserIdentity(ctx);
    const delegations = await this.delegationAccess.listActiveForUser(identity.id);
    const activePersona = this.resolveIdentityPersona(identity, ctx, delegations);
    const user = await this.hydrateIdentityUser(identity, activePersona);
    return this.buildMeResponse(user, auth0User, ctx, delegations);
  }

  private resolveIdentityPersona(
    identity: UserPersonaShape & { personas?: PersonaId[] },
    ctx: RequestContext,
    delegations: DelegationGrant[]
  ): PersonaId | null {
    const personas = derivePersonas(identity);
    if (personas.length === 0) {
      if (delegations.length > 0) return null;
      throw new HttpException(
        'No persona profiles found for this user',
        HttpStatus.FORBIDDEN
      );
    }
    try {
      return resolveSessionPersona(identity, this.hasuraUserService.sessionPersonaContext(ctx));
    } catch (error: any) {
      if (delegations.length > 0) return null;
      throw error;
    }
  }

  private async hydrateIdentityUser(
    identity: any,
    activePersona: PersonaId | null
  ) {
    const user = { ...identity, active_persona: activePersona };
    if (activePersona) {
      const addresses = await this.hasuraSystemService.getAllUserAddresses(
        identity.id,
        activePersona
      );
      user.addresses = addresses;
    } else {
      user.addresses = [];
    }
    return user;
  }

  private async buildMeResponse(
    user: any,
    auth0User: any,
    ctx: RequestContext,
    delegations: DelegationGrant[]
  ) {
    const verifiedViaAuthSession =
      await this.syncVerificationAndContractAfterAuth(user, auth0User?.sub);
    const verifiedFlags = verifiedViaAuthSession
      ? this.verifiedFlagsForAuthChannel(user, auth0User?.sub)
      : {};
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
      active_persona: user.active_persona,
      delegations,
      active_context: this.resolveActiveContext(ctx, user.active_persona, delegations),
      user: {
        ...user,
        email_verified:
          verifiedFlags.email_verified === true ? true : user.email_verified,
        phone_number_verified:
          verifiedFlags.phone_number_verified === true
            ? true
            : user.phone_number_verified,
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
  }

  private resolveActiveContext(
    ctx: RequestContext,
    activePersona: PersonaId | null,
    delegations: DelegationGrant[]
  ) {
    const header = ctx.activeDelegation?.trim();
    if (header && delegations.some((d) => d.id === header)) {
      return { kind: 'delegation' as const, delegationId: header };
    }
    if (activePersona) {
      return { kind: 'persona' as const, persona: activePersona };
    }
    return null;
  }

  @Get('me/referred-businesses')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List businesses referred by the current user (any persona)',
  })
  @ApiResponse({ status: 200, description: 'Referred businesses list' })
  async getMyReferredBusinesses(@ReqContext() ctx: RequestContext) {
    try {
      const user = await this.hasuraUserService.getUser(ctx);
      const businesses =
        await this.businessReferralsService.listReferredBusinessesForUser({
          agentId: user.agent?.id ?? null,
          businessId: user.business?.id ?? null,
        });
      return { success: true, businesses };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to load referred businesses',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('me/referred-businesses-summary')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Referral summary for the current user (user-level code)',
  })
  @ApiResponse({ status: 200, description: 'Referral summary' })
  async getMyReferredBusinessesSummary(@ReqContext() ctx: RequestContext) {
    try {
      const user = await this.hasuraUserService.getUser(ctx);
      const summary =
        await this.businessReferralsService.getUserReferralsSummary({
          userId: user.id,
          agentId: user.agent?.id ?? null,
          businessId: user.business?.id ?? null,
        });
      return {
        success: true,
        ...summary,
        referredBusinessCount: summary.referredCount,
        agentCode: summary.referralCode,
        businessCode: summary.referralCode,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to load referral summary',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
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
      agent_focus?: 'delivery' | 'commercial' | 'both';
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
        agent_focus?: 'delivery' | 'commercial' | 'both';
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
        let signupReferral: ResolvedBusinessReferral | null = null;
        if (personas.includes('business') || personas.includes('agent')) {
          signupReferral =
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
          agent_focus: userData.profile?.agent_focus,
          business_name:
            userData.profile?.name?.trim() ||
            `${userData.first_name}'s Business`,
          main_interest: mi,
          ...this.businessReferralsService.getBusinessInsertReferralFields(
            signupReferral
          ),
          ...this.agentReferralsService.getAgentInsertReferralFields(
            signupReferral
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
            const seeded = await this.addressesService.createAddressForSignup(
              uid,
              inserted.business.id,
              'business',
              addressData
            );
            if (seeded.businessLocationId) {
              await this.mobilePaymentPhoneSeedService.ensureAndLinkContactPhoneToLocation(
                uid,
                seeded.businessLocationId,
                addressData.country,
                userData.phone_number
              );
            }
          }
        }
        if (inserted.business?.id && signupReferral) {
          await this.businessReferralsService.notifyReferrerOfBusinessReferral(
            {
              businessId: inserted.business.id,
              countryCode: userData.address?.country,
              businessName:
                userData.profile?.name?.trim() ||
                `${userData.first_name}'s Business`,
              businessOwnerName:
                `${userData.first_name} ${userData.last_name}`.trim(),
            },
            signupReferral
          );
          await this.awardReferralOpsCredit(signupReferral, {
            kind: 'business',
            id: inserted.business.id,
          });
        }
        if (inserted.agent?.id && signupReferral) {
          await this.awardReferralOpsCredit(signupReferral, {
            kind: 'agent',
            id: inserted.agent.id,
          });
        }
        if (inserted.business?.id) {
          this.scheduleEnsureContract(inserted.business.id);
          await this.launchPromoService.claimSlotIfAvailable(
            inserted.business.id,
            userData.address?.country
          );
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
      agent_focus?: 'delivery' | 'commercial' | 'both';
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
        await this.seedAddressOrRollbackPersona(
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
      const focus =
        body.agent_focus === 'delivery' ||
        body.agent_focus === 'commercial' ||
        body.agent_focus === 'both'
          ? body.agent_focus
          : 'both';
      const agentReferral =
        await this.businessReferralsService.resolveBusinessReferralCode(
          body.referral_agent_code,
          uid
        );
      const referralFields =
        this.agentReferralsService.getAgentInsertReferralFields(agentReferral);
      const hasAgentReferrer = Boolean(referralFields.agent_referral_agent_id);
      const hasBusinessReferrer = Boolean(
        referralFields.agent_referral_business_id
      );
      const r = await this.hasuraSystemService.executeMutation<{
        insert_agents_one: { id: string };
      }>(
        hasAgentReferrer
          ? `
        mutation AddAgent(
          $userId: uuid!
          $vt: vehicle_types_enum!
          $focus: agent_focus_enum!
          $agentId: uuid!
          $referralCode: String!
        ) {
          insert_agents_one(object: {
            user_id: $userId
            vehicle_type_id: $vt
            focus: $focus
            referred_by_agent_id: $agentId
            referral_code_used: $referralCode
          }) {
            id
            user_id
            vehicle_type_id
            focus
            created_at
            updated_at
          }
        }
      `
          : hasBusinessReferrer
            ? `
        mutation AddAgent(
          $userId: uuid!
          $vt: vehicle_types_enum!
          $focus: agent_focus_enum!
          $referrerBusinessId: uuid!
          $referralCode: String!
        ) {
          insert_agents_one(object: {
            user_id: $userId
            vehicle_type_id: $vt
            focus: $focus
            referred_by_business_id: $referrerBusinessId
            referral_code_used: $referralCode
          }) {
            id
            user_id
            vehicle_type_id
            focus
            created_at
            updated_at
          }
        }
      `
            : `
        mutation AddAgent(
          $userId: uuid!
          $vt: vehicle_types_enum!
          $focus: agent_focus_enum!
        ) {
          insert_agents_one(object: {
            user_id: $userId
            vehicle_type_id: $vt
            focus: $focus
          }) {
            id
            user_id
            vehicle_type_id
            focus
            created_at
            updated_at
          }
        }
      `,
        hasAgentReferrer
          ? {
              userId: uid,
              vt,
              focus,
              agentId: referralFields.agent_referral_agent_id,
              referralCode: referralFields.agent_referral_code_used,
            }
          : hasBusinessReferrer
            ? {
                userId: uid,
                vt,
                focus,
                referrerBusinessId: referralFields.agent_referral_business_id,
                referralCode: referralFields.agent_referral_code_used,
              }
            : { userId: uid, vt, focus }
      );
      if (source) {
        await this.seedAddressOrRollbackPersona(
          uid,
          r.insert_agents_one.id,
          'agent',
          source
        );
      }
      if (agentReferral) {
        await this.awardReferralOpsCredit(agentReferral, {
          kind: 'agent',
          id: r.insert_agents_one.id,
        });
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
      const hasAgentReferral = Boolean(
        referralFields.business_referral_agent_id
      );
      const hasBusinessReferral = Boolean(
        referralFields.business_referral_business_id
      );
      const r = await this.hasuraSystemService.executeMutation<{
        insert_businesses_one: { id: string };
      }>(
        hasAgentReferral
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
          : hasBusinessReferral
            ? `
        mutation AddBusiness(
          $userId: uuid!
          $name: String!
          $mi: business_main_interest_enum!
          $referrerBusinessId: uuid!
          $referralCode: String!
        ) {
          insert_businesses_one(object: {
            user_id: $userId
            name: $name
            main_interest: $mi
            referred_by_business_id: $referrerBusinessId
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
        hasAgentReferral
          ? {
              userId: uid,
              name,
              mi,
              agentId: referralFields.business_referral_agent_id,
              referralCode: referralFields.business_referral_code_used,
            }
          : hasBusinessReferral
            ? {
                userId: uid,
                name,
                mi,
                referrerBusinessId:
                  referralFields.business_referral_business_id,
                referralCode: referralFields.business_referral_code_used,
              }
            : { userId: uid, name, mi }
      );
      if (source) {
        const locationId = await this.seedAddressOrRollbackPersona(
          uid,
          r.insert_businesses_one.id,
          'business',
          source,
          name
        );
        if (locationId) {
          await this.mobilePaymentPhoneSeedService.ensureAndLinkContactPhoneToLocation(
            uid,
            locationId,
            source.country,
            user.phone_number
          );
        }
      } else {
        await this.ensureBusinessContactPaymentPhone(
          uid,
          user.phone_number,
          await this.resolveUserCountry(user)
        );
      }
      const countryCode = await this.resolveUserCountry(user);
      if (businessReferral) {
        await this.businessReferralsService.notifyReferrerOfBusinessReferral(
          {
            businessId: r.insert_businesses_one.id,
            countryCode: source?.country ?? countryCode ?? undefined,
            businessName: name,
            businessOwnerName:
              `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
          },
          businessReferral
        );
        await this.awardReferralOpsCredit(businessReferral, {
          kind: 'business',
          id: r.insert_businesses_one.id,
        });
      }
      this.scheduleEnsureContract(r.insert_businesses_one.id);
      await this.launchPromoService.claimSlotIfAvailable(
        r.insert_businesses_one.id,
        source?.country ?? countryCode
      );
      return { success: true, business: r.insert_businesses_one };
    }
    throw new HttpException('Invalid persona', HttpStatus.BAD_REQUEST);
  }

  private async seedAddressOrRollbackPersona(
    userId: string,
    entityId: string,
    persona: PersonaId,
    source: AddressResponse,
    businessName?: string
  ): Promise<string | null> {
    try {
      const args: [string, string, PersonaId, AddressResponse, string?] =
        businessName === undefined
          ? [userId, entityId, persona, source]
          : [userId, entityId, persona, source, businessName];
      return await this.addressesService.seedDefaultAddressForNewPersona(
        ...args
      );
    } catch (error: any) {
      await this.rollbackNewPersona(persona, entityId);
      throw error;
    }
  }

  private async ensureBusinessContactPaymentPhone(
    userId: string,
    phoneRaw: string | null | undefined,
    countryCode: string | null | undefined
  ): Promise<void> {
    try {
      await this.mobilePaymentPhoneSeedService.ensureFromContactPhone(
        userId,
        countryCode,
        phoneRaw
      );
    } catch (error: any) {
      this.logger.warn(
        `ensureBusinessContactPaymentPhone failed for ${userId}: ${error?.message || error}`
      );
    }
  }

  private async rollbackNewPersona(
    persona: PersonaId,
    entityId: string
  ): Promise<void> {
    const tables: Record<PersonaId, string> = {
      client: 'clients',
      agent: 'agents',
      business: 'businesses',
    };
    const table = tables[persona];
    await this.hasuraSystemService.executeMutation(
      `mutation RollbackPersona($id: uuid!) {
        delete_${table}_by_pk(id: $id) { id }
      }`,
      { id: entityId }
    );
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
    const result = await this.hasuraSystemService.executeMutation<{
      update_users_by_pk: Record<string, unknown>;
    }>(GQL_UPDATE_USER_EMAIL, { id: userId, email });
    return { success: true, user: result.update_users_by_pk };
  }
}
