import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { StripeConfig } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { DbPaymentCapabilityStatus } from '../merchant-lifecycle/merchant-lifecycle.types';
import { PaymentRoutingService } from './payment-routing.service';
import { isStripeIdempotencyInProgressError } from './stripe-idempotency';
import { StripeService } from './stripe.service';

export interface StripeConnectAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  account_type: string;
  country?: string;
  default_currency?: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  disabled_reason?: string;
  status: 'pending' | 'active' | 'restricted' | 'disabled';
  created_at: string;
  updated_at: string;
}

const ACCOUNT_FIELDS = `
  id
  user_id
  stripe_account_id
  account_type
  country
  default_currency
  charges_enabled
  payouts_enabled
  details_submitted
  disabled_reason
  status
  created_at
  updated_at
`;

@Injectable()
export class StripeConnectService {
  private readonly ensureAccountInFlight = new Map<
    string,
    Promise<StripeConnectAccount>
  >();

  constructor(
    private readonly stripeService: StripeService,
    private readonly hasuraService: HasuraSystemService,
    private readonly paymentRouting: PaymentRoutingService,
    private readonly configService: ConfigService,
    private readonly merchantLifecycleService: MerchantLifecycleService
  ) {}

  private get config(): StripeConfig {
    return this.configService.get<StripeConfig>('stripe') as StripeConfig;
  }

  async getByUserId(userId: string): Promise<StripeConnectAccount | null> {
    const query = `
      query GetConnectAccount($userId: uuid!) {
        stripe_connect_accounts(where: { user_id: { _eq: $userId } }, limit: 1) {
          ${ACCOUNT_FIELDS}
        }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { userId });
    return (response.stripe_connect_accounts || [])[0] || null;
  }

  async getByStripeAccountId(
    stripeAccountId: string
  ): Promise<StripeConnectAccount | null> {
    const query = `
      query GetConnectAccountByStripeId($id: String!) {
        stripe_connect_accounts(
          where: { stripe_account_id: { _eq: $id } }
          limit: 1
        ) { ${ACCOUNT_FIELDS} }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, {
      id: stripeAccountId,
    });
    return (response.stripe_connect_accounts || [])[0] || null;
  }

  /** Create the Stripe Express account + DB row for a user if missing. */
  async ensureAccount(userId: string): Promise<StripeConnectAccount> {
    const inFlight = this.ensureAccountInFlight.get(userId);
    if (inFlight) return inFlight;

    const promise = this.ensureAccountOnce(userId).finally(() => {
      this.ensureAccountInFlight.delete(userId);
    });
    this.ensureAccountInFlight.set(userId, promise);
    return promise;
  }

  private async ensureAccountOnce(
    userId: string
  ): Promise<StripeConnectAccount> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;
    return this.createAccountForUser(userId);
  }

  private async createAccountForUser(
    userId: string
  ): Promise<StripeConnectAccount> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;
    const created = await this.createStripeExpressAccount(userId);
    return this.insertAccountRow(userId, created.account, created.country);
  }

  private async createStripeExpressAccount(
    userId: string
  ): Promise<{ account: Stripe.Account; country: string }> {
    const country = await this.requireUserCountry(userId);
    const profile = await this.getUserConnectPrefill(userId);
    try {
      const account = await this.stripeService.createExpressAccount({
        country,
        userId,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        businessName: profile.businessName,
      });
      return { account, country };
    } catch (error: any) {
      this.rethrowConnectCreateError(error);
    }
  }

  private async requireUserCountry(userId: string): Promise<string> {
    const countryCode = await this.paymentRouting.getUserCountryCode(userId);
    if (countryCode) return countryCode;
    throw new HttpException(
      { success: false, message: 'Unable to determine user country' },
      HttpStatus.BAD_REQUEST
    );
  }

  private rethrowConnectCreateError(error: any): never {
    if (isStripeIdempotencyInProgressError(error)) {
      throw new HttpException(
        {
          success: false,
          message: 'Stripe onboarding is already in progress. Please try again.',
        },
        HttpStatus.CONFLICT
      );
    }
    throw error;
  }

  private async getUserConnectPrefill(userId: string): Promise<{
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    businessName?: string;
  }> {
    const query = `
      query GetUserConnectPrefill($userId: uuid!) {
        users_by_pk(id: $userId) {
          email
          first_name
          last_name
          phone_number
          business { name }
        }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { userId });
    const user = response.users_by_pk;
    if (!user) return {};
    return {
      email: user.email || undefined,
      firstName: user.first_name || undefined,
      lastName: user.last_name || undefined,
      phone: user.phone_number || undefined,
      businessName: user.business?.name || undefined,
    };
  }

  private async insertAccountRow(
    userId: string,
    account: Stripe.Account,
    country: string
  ): Promise<StripeConnectAccount> {
    const inserted = await this.tryInsertAccountRow(userId, account, country);
    if (inserted) return inserted;
    return this.requireExistingAccount(userId);
  }

  private async tryInsertAccountRow(
    userId: string,
    account: Stripe.Account,
    country: string
  ): Promise<StripeConnectAccount | null> {
    try {
      const mutation = `
        mutation InsertConnectAccount($data: stripe_connect_accounts_insert_input!) {
          insert_stripe_connect_accounts_one(
            object: $data
            on_conflict: {
              constraint: stripe_connect_accounts_user_id_key
              update_columns: []
            }
          ) { ${ACCOUNT_FIELDS} }
        }
      `;
      const response = await this.hasuraService.executeMutation(mutation, {
        data: this.buildInsertAccountData(userId, account, country),
      });
      return response.insert_stripe_connect_accounts_one ?? null;
    } catch (error: any) {
      if (this.isUniqueViolation(error)) return null;
      throw error;
    }
  }

  private isUniqueViolation(error: any): boolean {
    const message = String(error?.message ?? '');
    return (
      message.includes('Uniqueness violation') ||
      message.includes('duplicate key value violates unique constraint')
    );
  }

  private async requireExistingAccount(
    userId: string
  ): Promise<StripeConnectAccount> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;
    throw new Error(
      'Connect account insert conflicted but no existing row was found'
    );
  }

  private buildInsertAccountData(
    userId: string,
    account: Stripe.Account,
    country: string
  ) {
    return {
      user_id: userId,
      stripe_account_id: account.id,
      account_type: 'express',
      country,
      default_currency: account.default_currency?.toUpperCase(),
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      status: this.deriveStatus(account),
    };
  }

  async createOnboardingLink(
    userId: string,
    overrides?: {
      returnUrl?: string;
      refreshUrl?: string;
      platform?: 'mobile' | 'web';
    }
  ): Promise<{ url: string }> {
    const account = await this.ensureAccount(userId);
    const base = this.config.appBaseUrl;
    // Stripe only accepts http(s) return/refresh URLs. For the mobile app we
    // route to an HTTPS page that deep-links back into the app (?app=mobile).
    const appFlag = overrides?.platform === 'mobile' ? '?app=mobile' : '';
    const link = await this.stripeService.createAccountLink(
      account.stripe_account_id,
      overrides?.refreshUrl || `${base}/connect/onboarding/refresh${appFlag}`,
      overrides?.returnUrl || `${base}/connect/onboarding/return${appFlag}`
    );
    return { url: link.url };
  }

  async createLoginLink(userId: string): Promise<{ url: string }> {
    const account = await this.getByUserId(userId);
    if (!account) {
      throw new HttpException(
        { success: false, message: 'No Stripe Connect account found' },
        HttpStatus.NOT_FOUND
      );
    }
    const link = await this.stripeService.createLoginLink(
      account.stripe_account_id
    );
    return { url: link.url };
  }

  /** Refresh local state from Stripe (used by status endpoint and webhook). */
  async syncFromStripe(stripeAccountId: string): Promise<void> {
    const account = await this.stripeService.retrieveAccount(stripeAccountId);
    await this.updateAccountRow(account);
    await this.syncUserActivation(account);
  }

  /**
   * Stripe Connect updates business payment capability; agents keep legacy is_verified sync.
   */
  private async syncUserActivation(account: Stripe.Account): Promise<void> {
    const row = await this.getByStripeAccountId(account.id);
    if (!row) return;

    const businessId = await this.merchantLifecycleService.getBusinessIdForUser(
      row.user_id
    );
    if (businessId) {
      await this.merchantLifecycleService.upsertPaymentAccount({
        businessId,
        provider: 'stripe',
        capabilityStatus: this.mapStripeCapabilityStatus(account),
        externalReference: account.id,
        rejectionReason: account.requirements?.disabled_reason ?? null,
      });
    }

    const agentVerified = this.deriveStatus(account) === 'active';
    await this.setAgentVerified(row.user_id, agentVerified);
  }

  private mapStripeCapabilityStatus(
    account: Stripe.Account
  ): DbPaymentCapabilityStatus {
    if (account.charges_enabled && account.payouts_enabled) return 'verified';
    if (account.requirements?.disabled_reason) return 'rejected';
    if (account.details_submitted) return 'verification_pending';
    return 'in_progress';
  }

  private async setAgentVerified(
    userId: string,
    verified: boolean
  ): Promise<void> {
    const mutation = `
      mutation SetAgentVerification($userId: uuid!, $verified: Boolean!) {
        update_agents(
          where: { user_id: { _eq: $userId } }
          _set: { is_verified: $verified }
        ) { affected_rows }
      }
    `;
    await this.hasuraService.executeMutation(mutation, { userId, verified });
  }

  private async updateAccountRow(account: Stripe.Account): Promise<void> {
    const mutation = `
      mutation UpdateConnectAccount(
        $id: String!
        $data: stripe_connect_accounts_set_input!
      ) {
        update_stripe_connect_accounts(
          where: { stripe_account_id: { _eq: $id } }
          _set: $data
        ) { affected_rows }
      }
    `;
    await this.hasuraService.executeMutation(mutation, {
      id: account.id,
      data: {
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        default_currency: account.default_currency?.toUpperCase(),
        disabled_reason: account.requirements?.disabled_reason ?? null,
        status: this.deriveStatus(account),
      },
    });
  }

  private deriveStatus(
    account: Stripe.Account
  ): StripeConnectAccount['status'] {
    if (account.charges_enabled && account.payouts_enabled) return 'active';
    if (account.requirements?.disabled_reason) return 'disabled';
    if (account.details_submitted) return 'restricted';
    return 'pending';
  }

  async getStatus(userId: string): Promise<{
    connected: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    status: string;
    paymentRail: 'stripe' | 'mobile_money';
  }> {
    let account = await this.getByUserId(userId);
    if (account) {
      await this.syncFromStripe(account.stripe_account_id);
      account = await this.getByUserId(userId);
    }
    const paymentRail = await this.paymentRouting.resolveRailForUser(userId);
    return {
      connected: !!account,
      chargesEnabled: account?.charges_enabled ?? false,
      payoutsEnabled: account?.payouts_enabled ?? false,
      detailsSubmitted: account?.details_submitted ?? false,
      status: account?.status ?? 'not_started',
      paymentRail,
    };
  }

  /** True when the user can receive Stripe payouts/transfers. */
  async isPayoutReady(userId: string): Promise<boolean> {
    const account = await this.getByUserId(userId);
    return !!account && account.charges_enabled && account.payouts_enabled;
  }
}
