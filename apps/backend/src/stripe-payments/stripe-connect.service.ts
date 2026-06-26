import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { StripeConfig } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { PaymentRoutingService } from './payment-routing.service';
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
  constructor(
    private readonly stripeService: StripeService,
    private readonly hasuraService: HasuraSystemService,
    private readonly paymentRouting: PaymentRoutingService,
    private readonly configService: ConfigService
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
    const existing = await this.getByUserId(userId);
    if (existing) return existing;

    const countryCode = await this.paymentRouting.getUserCountryCode(userId);
    if (!countryCode) {
      throw new HttpException(
        { success: false, message: 'Unable to determine user country' },
        HttpStatus.BAD_REQUEST
      );
    }
    const email = await this.getUserEmail(userId);
    const account = await this.stripeService.createExpressAccount({
      country: countryCode,
      email,
      userId,
    });
    return this.insertAccountRow(userId, account, countryCode);
  }

  private async getUserEmail(userId: string): Promise<string | undefined> {
    const query = `
      query GetUserEmail($userId: uuid!) {
        users_by_pk(id: $userId) { email }
      }
    `;
    const response = await this.hasuraService.executeQuery(query, { userId });
    return response.users_by_pk?.email || undefined;
  }

  private async insertAccountRow(
    userId: string,
    account: Stripe.Account,
    country: string
  ): Promise<StripeConnectAccount> {
    const mutation = `
      mutation InsertConnectAccount($data: stripe_connect_accounts_insert_input!) {
        insert_stripe_connect_accounts_one(object: $data) { ${ACCOUNT_FIELDS} }
      }
    `;
    const response = await this.hasuraService.executeMutation(mutation, {
      data: {
        user_id: userId,
        stripe_account_id: account.id,
        account_type: 'express',
        country,
        default_currency: account.default_currency?.toUpperCase(),
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        status: this.deriveStatus(account),
      },
    });
    return response.insert_stripe_connect_accounts_one;
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
   * Stripe Connect acts as auto-validation for stripe-rail users: when the
   * connected account is active (charges + payouts enabled) the linked
   * business and/or agent are verified; otherwise they are de-verified.
   */
  private async syncUserActivation(account: Stripe.Account): Promise<void> {
    const row = await this.getByStripeAccountId(account.id);
    if (!row) return;
    const active = this.deriveStatus(account) === 'active';
    await this.setUserEntitiesVerified(row.user_id, active);
  }

  private async setUserEntitiesVerified(
    userId: string,
    verified: boolean
  ): Promise<void> {
    const mutation = `
      mutation SetUserVerification($userId: uuid!, $verified: Boolean!) {
        update_businesses(
          where: { user_id: { _eq: $userId } }
          _set: { is_verified: $verified }
        ) { affected_rows }
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
