import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { businessReferralPayoutConfigKeyFromUser } from '../admin/business-referral-payout-config.util';
import { ConfigService } from '@nestjs/config';
import { AgentReferralsService } from '../agents/agent-referrals.service';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  mapReferredBusinessRow,
  REFERRED_BUSINESSES_LIST_SELECTION,
  type ReferredBusinessFollowUp,
  type ReferredBusinessRow,
} from './referred-business-followup.util';

export interface BusinessReferralParams {
  businessId: string;
  countryCode?: string;
  businessName: string;
  businessOwnerName: string;
}

export type ResolvedBusinessReferral =
  | {
      kind: 'agent';
      agentId: string;
      normalizedCode: string;
      userEmail: string;
      userFirstName: string;
      preferredLanguage: string;
    }
  | {
      kind: 'business';
      businessId: string;
      businessName: string;
      normalizedCode: string;
      userId: string;
      userEmail: string;
      userFirstName: string;
      preferredLanguage: string;
    };

export interface BusinessCodeLookup {
  businessId: string;
  businessName: string;
  businessCode: string;
  userId: string;
  userEmail: string;
  userFirstName: string;
  preferredLanguage: string;
  lifecycleStatus: string;
}

@Injectable()
export class BusinessReferralsService {
  private readonly logger = new Logger(BusinessReferralsService.name);

  constructor(
    private readonly agentReferralsService: AgentReferralsService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  normalizeReferralCode(code: string): string | null {
    return this.agentReferralsService.normalizeAgentCode(code);
  }

  async resolveBusinessReferralCode(
    referralCode?: string,
    excludeUserId?: string
  ): Promise<ResolvedBusinessReferral | null> {
    const rawCode = referralCode?.trim();
    if (!rawCode) {
      return null;
    }

    const normalizedCode = this.normalizeReferralCode(rawCode);
    if (!normalizedCode) {
      this.throwReferralError('Invalid referral code format');
    }

    const fromUser = await this.resolveFromUserReferralCode(
      normalizedCode,
      excludeUserId
    );
    if (fromUser) {
      return fromUser;
    }

    const agent = await this.agentReferralsService.findAgentByCode(normalizedCode);
    const business = await this.findBusinessByCode(normalizedCode);

    // Codes are unique across agents + businesses; guard against legacy collisions.
    if (agent?.status === 'active' && business) {
      this.throwReferralError('This referral code is not currently active');
    }

    if (agent?.status === 'active') {
      if (excludeUserId && agent.userId === excludeUserId) {
        this.throwReferralError('You cannot use your own referral code');
      }
      return {
        kind: 'agent',
        agentId: agent.agentId,
        normalizedCode,
        userEmail: agent.userEmail,
        userFirstName: agent.userFirstName,
        preferredLanguage: agent.preferredLanguage,
      };
    }

    if (!business) {
      if (agent) {
        this.throwReferralError('This referral code is not currently active');
      }
      this.throwReferralError('No referrer found for this referral code');
    }
    if (business.lifecycleStatus === 'suspended') {
      this.throwReferralError('This referral code is not currently active');
    }
    if (excludeUserId && business.userId === excludeUserId) {
      this.throwReferralError('You cannot use your own referral code');
    }

    return {
      kind: 'business',
      businessId: business.businessId,
      businessName: business.businessName,
      normalizedCode,
      userId: business.userId,
      userEmail: business.userEmail,
      userFirstName: business.userFirstName,
      preferredLanguage: business.preferredLanguage,
    };
  }

  /**
   * Prefer users.referral_code, then attribute to the user's agent persona
   * (if active) else their business persona so existing FKs keep working.
   */
  private async resolveFromUserReferralCode(
    normalizedCode: string,
    excludeUserId?: string
  ): Promise<ResolvedBusinessReferral | null> {
    const user = await this.findUserByReferralCode(normalizedCode);
    if (!user) return null;
    if (excludeUserId && user.userId === excludeUserId) {
      this.throwReferralError('You cannot use your own referral code');
    }

    const agent = await this.findActiveAgentForUser(user.userId);
    if (agent) {
      return {
        kind: 'agent',
        agentId: agent.agentId,
        normalizedCode,
        userEmail: user.userEmail,
        userFirstName: user.userFirstName,
        preferredLanguage: user.preferredLanguage,
      };
    }

    const business = await this.findBusinessForUser(user.userId);
    if (!business) {
      this.throwReferralError('This referral code is not currently active');
    }
    if (business.lifecycleStatus === 'suspended') {
      this.throwReferralError('This referral code is not currently active');
    }
    return {
      kind: 'business',
      businessId: business.businessId,
      businessName: business.businessName,
      normalizedCode,
      userId: user.userId,
      userEmail: user.userEmail,
      userFirstName: user.userFirstName,
      preferredLanguage: user.preferredLanguage,
    };
  }

  async findUserByReferralCode(code: string): Promise<{
    userId: string;
    userEmail: string;
    userFirstName: string;
    userLastName: string;
    preferredLanguage: string;
    referralCode: string;
    internal: boolean;
  } | null> {
    const normalizedCode = this.normalizeReferralCode(code);
    if (!normalizedCode) return null;
    const query = `
      query FindUserByReferralCode($code: String!) {
        users(where: { referral_code: { _eq: $code } }, limit: 1) {
          id
          email
          first_name
          last_name
          preferred_language
          referral_code
          internal
          account_status
        }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        code: normalizedCode,
      });
      const row = result?.users?.[0];
      if (!row || row.account_status === 'deleted') return null;
      return {
        userId: row.id,
        userEmail: row.email ?? '',
        userFirstName: row.first_name ?? '',
        userLastName: row.last_name ?? '',
        preferredLanguage: row.preferred_language ?? 'en',
        referralCode: row.referral_code,
        internal: row.internal === true,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to find user by referral code ${normalizedCode}: ${error.message}`
      );
      return null;
    }
  }

  /** True when the user can act as a referrer (active agent or non-suspended business). */
  async userCanRefer(userId: string): Promise<boolean> {
    const agent = await this.findActiveAgentForUser(userId);
    if (agent) return true;
    const business = await this.findBusinessForUser(userId);
    return !!business && business.lifecycleStatus !== 'suspended';
  }

  private async findActiveAgentForUser(
    userId: string
  ): Promise<{ agentId: string } | null> {
    const query = `
      query ActiveAgentForUser($userId: uuid!) {
        agents(
          where: { user_id: { _eq: $userId }, status: { _eq: "active" } }
          limit: 1
        ) { id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
    });
    const agentId = result?.agents?.[0]?.id;
    return agentId ? { agentId } : null;
  }

  private async findBusinessForUser(userId: string): Promise<{
    businessId: string;
    businessName: string;
    lifecycleStatus: string;
  } | null> {
    const query = `
      query BusinessForUser($userId: uuid!) {
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
          id
          name
          lifecycle_status
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
    });
    const row = result?.businesses?.[0];
    if (!row) return null;
    return {
      businessId: row.id,
      businessName: row.name ?? '',
      lifecycleStatus: row.lifecycle_status ?? 'created',
    };
  }

  getBusinessInsertReferralFields(resolved: ResolvedBusinessReferral | null): {
    business_referral_agent_id?: string;
    business_referral_business_id?: string;
    business_referral_code_used?: string;
  } {
    if (!resolved) {
      return {};
    }
    if (resolved.kind === 'agent') {
      return {
        business_referral_agent_id: resolved.agentId,
        business_referral_code_used: resolved.normalizedCode,
      };
    }
    return {
      business_referral_business_id: resolved.businessId,
      business_referral_code_used: resolved.normalizedCode,
    };
  }

  async findBusinessByCode(
    businessCode: string
  ): Promise<BusinessCodeLookup | null> {
    const normalizedCode = this.normalizeReferralCode(businessCode);
    if (!normalizedCode) return null;

    const query = `
      query FindBusinessByCode($code: String!) {
        businesses(where: { business_code: { _eq: $code } }, limit: 1) {
          id
          name
          business_code
          lifecycle_status
          user {
            id
            first_name
            email
            preferred_language
          }
        }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        code: normalizedCode,
      });
      const row = result?.businesses?.[0];
      if (!row?.user) return null;
      return {
        businessId: row.id,
        businessName: row.name ?? '',
        businessCode: row.business_code,
        userId: row.user.id,
        userEmail: row.user.email ?? '',
        userFirstName: row.user.first_name ?? '',
        preferredLanguage: row.user.preferred_language ?? 'en',
        lifecycleStatus: row.lifecycle_status ?? 'created',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to find business by code ${normalizedCode}: ${error.message}`
      );
      return null;
    }
  }

  async notifyReferrerOfBusinessReferral(
    params: BusinessReferralParams,
    resolved: ResolvedBusinessReferral
  ): Promise<void> {
    if (resolved.kind === 'agent') {
      await this.notifyAgentOfBusinessReferral(params, resolved);
      return;
    }
    await this.notifyBusinessOfBusinessReferral(params, resolved);
  }

  async notifyAgentOfBusinessReferral(
    params: BusinessReferralParams,
    resolved: Extract<ResolvedBusinessReferral, { kind: 'agent' }>
  ): Promise<void> {
    const rail = await this.paymentRoutingService.resolveRailForCountry(
      params.countryCode
    );
    const dashboardUrl = `${this.getPublicWebAppUrl()}/agent/dashboard`;

    try {
      await this.notificationsService.sendAgentBusinessReferredEmail({
        to: resolved.userEmail,
        preferredLanguage: resolved.preferredLanguage,
        recipientName: resolved.userFirstName,
        businessName: params.businessName,
        businessOwnerName: params.businessOwnerName,
        paymentRail: rail,
        dashboardUrl,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to send agent business referred email for business ${params.businessId}: ${error.message}`
      );
    }
  }

  private async notifyBusinessOfBusinessReferral(
    params: BusinessReferralParams,
    resolved: Extract<ResolvedBusinessReferral, { kind: 'business' }>
  ): Promise<void> {
    const dashboardUrl = `${this.getPublicWebAppUrl()}/business/dashboard`;
    const isFr = resolved.preferredLanguage.toLowerCase().startsWith('fr');
    const title = isFr ? 'Nouveau commerce parrainé' : 'New business referral';
    const body = isFr
      ? `${params.businessName} s'est inscrit avec votre code. Identifié + 10 articles approuvés = votre bonus.`
      : `${params.businessName} signed up with your code. Identified + 10 approved items = your bonus.`;

    try {
      if (resolved.userEmail?.trim()) {
        await this.notificationsService.sendAgentBusinessReferredEmail({
          to: resolved.userEmail,
          preferredLanguage: resolved.preferredLanguage,
          recipientName: resolved.userFirstName || resolved.businessName,
          businessName: params.businessName,
          businessOwnerName: params.businessOwnerName,
          paymentRail: await this.paymentRoutingService.resolveRailForCountry(
            params.countryCode
          ),
          dashboardUrl,
        });
      }
      await this.notificationsService.sendInternalPushByUserId(
        resolved.userId,
        title,
        body,
        { url: '/business/dashboard', event: 'business_referred_business' }
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to notify referring business ${resolved.businessId}: ${error.message}`
      );
    }
  }

  async listReferredBusinesses(
    businessId: string
  ): Promise<ReferredBusinessFollowUp[]> {
    const query = `
      query BusinessReferredBusinesses($businessId: uuid!) {
        businesses(
          where: { referred_by_business_id: { _eq: $businessId } }
          order_by: { created_at: desc }
        ) {
          ${REFERRED_BUSINESSES_LIST_SELECTION}
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      businesses: ReferredBusinessRow[];
    }>(query, { businessId });
    return (result?.businesses ?? []).map(mapReferredBusinessRow);
  }

  async listReferredBusinessesForUser(params: {
    agentId?: string | null;
    businessId?: string | null;
  }): Promise<ReferredBusinessFollowUp[]> {
    const orFilters: Array<Record<string, unknown>> = [];
    if (params.agentId) {
      orFilters.push({ referred_by_agent_id: { _eq: params.agentId } });
    }
    if (params.businessId) {
      orFilters.push({ referred_by_business_id: { _eq: params.businessId } });
    }
    if (orFilters.length === 0) return [];

    const query = `
      query UserReferredBusinesses($where: businesses_bool_exp!) {
        businesses(where: $where, order_by: { created_at: desc }) {
          ${REFERRED_BUSINESSES_LIST_SELECTION}
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      businesses: ReferredBusinessRow[];
    }>(query, { where: { _or: orFilters } });
    return (result?.businesses ?? []).map(mapReferredBusinessRow);
  }

  async getUserReferralsSummary(params: {
    userId: string;
    agentId?: string | null;
    businessId?: string | null;
  }): Promise<{
    referralCode: string;
    referralAmount: number;
    currency: string;
    countryCode: string | null;
    minApprovedItems: number;
    referredCount: number;
    paidCount: number;
    internal: boolean;
  }> {
    const userQuery = `
      query UserReferralSummary($userId: uuid!) {
        users_by_pk(id: $userId) {
          referral_code
          internal
          country
          agent { id }
        }
      }
    `;
    const userResult = await this.hasuraSystemService.executeQuery(userQuery, {
      userId: params.userId,
    });
    const user = userResult?.users_by_pk;
    if (!user) {
      throw new HttpException(
        { success: false, error: 'User not found' },
        HttpStatus.NOT_FOUND
      );
    }

    const orFilters: Array<Record<string, unknown>> = [];
    if (params.agentId) {
      orFilters.push({ referred_by_agent_id: { _eq: params.agentId } });
    }
    if (params.businessId) {
      orFilters.push({ referred_by_business_id: { _eq: params.businessId } });
    }

    let referredCount = 0;
    let paidCount = 0;
    if (orFilters.length > 0) {
      const referredWhere = { _or: orFilters };
      const paidWhere = {
        _and: [referredWhere, { business_referral_payouts: {} }],
      };
      const countResult = await this.hasuraSystemService.executeQuery(
        `
        query UserReferredCounts(
          $referredWhere: businesses_bool_exp!
          $paidWhere: businesses_bool_exp!
        ) {
          businesses_aggregate(where: $referredWhere) {
            aggregate { count }
          }
          paid: businesses_aggregate(where: $paidWhere) {
            aggregate { count }
          }
        }
        `,
        { referredWhere, paidWhere }
      );
      referredCount =
        countResult?.businesses_aggregate?.aggregate?.count ?? 0;
      paidCount = countResult?.paid?.aggregate?.count ?? 0;
    }

    let countryCode = user.country
      ? String(user.country).toUpperCase()
      : null;
    if (!countryCode) {
      const fromRouting =
        await this.paymentRoutingService.getUserCountryCode(params.userId);
      countryCode = fromRouting ? String(fromRouting).toUpperCase() : null;
    }
    const currency = this.getCurrencyForCountry(countryCode);
    const internal = user.internal === true;
    const referralAmount = await this.getReferralPayoutAmount(
      countryCode,
      user
    );

    return {
      referralCode: user.referral_code,
      referralAmount,
      currency,
      countryCode,
      minApprovedItems: 10,
      referredCount,
      paidCount,
      internal,
    };
  }

  async getReferralsSummary(businessId: string): Promise<{
    businessCode: string;
    referralCode: string;
    referralAmount: number;
    currency: string;
    countryCode: string | null;
    minApprovedItems: number;
    referredCount: number;
    paidCount: number;
  }> {
    const query = `
      query BusinessReferralsSummary($businessId: uuid!) {
        businesses_by_pk(id: $businessId) {
          id
          business_code
          user_id
          user { referral_code internal country agent { id } }
          referred_businesses_aggregate {
            aggregate { count }
          }
          referral_payouts_earned_aggregate {
            aggregate { count }
          }
          business_locations(
            where: { is_active: { _eq: true } }
            order_by: { is_primary: desc }
            limit: 1
          ) {
            address { country }
          }
          business_addresses(limit: 1) {
            address { country }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    const business = result?.businesses_by_pk;
    if (!business) {
      throw new HttpException(
        { success: false, error: 'Business not found' },
        HttpStatus.NOT_FOUND
      );
    }

    let countryCode: string | null =
      business.user?.country ??
      business.business_locations?.[0]?.address?.country ??
      business.business_addresses?.[0]?.address?.country ??
      null;
    countryCode = countryCode ? String(countryCode).toUpperCase() : null;
    const currency = this.getCurrencyForCountry(countryCode);
    const referralAmount = await this.getReferralPayoutAmount(
      countryCode,
      business.user
    );
    const referralCode =
      business.user?.referral_code || business.business_code;

    return {
      businessCode: referralCode,
      referralCode,
      referralAmount,
      currency,
      countryCode,
      minApprovedItems: 10,
      referredCount: business.referred_businesses_aggregate?.aggregate?.count ?? 0,
      paidCount: business.referral_payouts_earned_aggregate?.aggregate?.count ?? 0,
    };
  }

  private async getReferralPayoutAmount(
    countryCode: string | null,
    user?: { internal?: boolean | null; agent?: { id?: string } | null } | null
  ): Promise<number> {
    if (!countryCode) return 0;
    try {
      const result = await this.hasuraSystemService.executeQuery(
        `query ReferralPayoutAmount($key: String!, $country: String!) {
          application_configurations(
            where: {
              config_key: { _eq: $key }
              country_code: { _eq: $country }
              status: { _eq: "active" }
            }
            limit: 1
          ) { number_value }
        }`,
        { key: businessReferralPayoutConfigKeyFromUser(user), country: countryCode }
      );
      return Number(result?.application_configurations?.[0]?.number_value ?? 0);
    } catch {
      return 0;
    }
  }

  private getCurrencyForCountry(countryCode: string | null): string {
    const map: Record<string, string> = {
      GA: 'XAF',
      CM: 'XAF',
      CA: 'CAD',
      US: 'USD',
    };
    return map[(countryCode ?? '').toUpperCase()] ?? 'XAF';
  }

  private throwReferralError(message: string): never {
    throw new HttpException(
      { success: false, error: message },
      HttpStatus.BAD_REQUEST
    );
  }

  private getPublicWebAppUrl(): string {
    return (
      this.configService.get<string>('publicWebAppUrl') || 'https://rendasua.com'
    ).replace(/\/$/, '');
  }
}
