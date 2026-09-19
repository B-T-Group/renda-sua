import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  creditExpiresAt,
  personaMatches,
  referrerAtCap,
  subjectStoreAmount,
  type CreditCampaign,
  type SignupCampaignEvent,
} from './credit-campaign.policy';
import { campaignCashCopy } from './payment-program.messages';
import { PurchaseCreditsService } from './purchase-credits.service';

const STALE_POSTING_MS = 60_000;

@Injectable()
export class CreditCampaignRunnerService {
  private readonly logger = new Logger(CreditCampaignRunnerService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly accounts: AccountsService,
    private readonly credits: PurchaseCreditsService,
    private readonly notifications: NotificationsService
  ) {}

  async applySignup(event: SignupCampaignEvent): Promise<{ applied: number }> {
    const country = event.country?.trim().toUpperCase();
    if (!event.userId || !country) return { applied: 0 };
    const rows = await this.load(country);
    let applied = 0;
    for (const campaign of rows) {
      if (!personaMatches(campaign.persona, event.personas || [])) continue;
      await this.applyOne(campaign, event);
      applied += 1;
    }
    return { applied };
  }

  private async applyOne(campaign: CreditCampaign, event: SignupCampaignEvent): Promise<void> {
    try {
      await this.grantSubject(campaign, event);
      await this.grantReferrer(campaign, event);
    } catch (error: any) {
      this.logger.warn(`Campaign ${campaign.id} failed: ${error?.message ?? error}`);
    }
  }

  private async grantSubject(campaign: CreditCampaign, event: SignupCampaignEvent): Promise<void> {
    const amount = subjectStoreAmount(campaign, Boolean(event.referrerUserId));
    if (amount <= 0) return;
    const id = await this.openGrant(subjectRow(campaign, event, amount));
    if (!id) return;
    const existingId = await this.storeCreditId(event.userId, campaign.id);
    if (existingId) {
      await this.finish(id, 'posted', null, existingId);
      return;
    }
    const result = await this.credits.grantCampaign(subjectGrant(campaign, event, amount));
    if ('skipped' in result) {
      await this.finish(id, 'skipped', result.skipped);
      return;
    }
    await this.finish(id, 'posted', null, result.id);
  }

  private async grantReferrer(campaign: CreditCampaign, event: SignupCampaignEvent): Promise<void> {
    const amount = Number(campaign.referrer_amount) || 0;
    const referrerId = event.referrerUserId;
    if (amount <= 0 || !referrerId) return;
    const id = await this.openGrant(referrerRow(campaign, event, amount));
    if (!id) return;
    await this.settleReferrer(campaign, referrerId, amount, id);
  }

  private async settleReferrer(
    campaign: CreditCampaign,
    referrerId: string,
    amount: number,
    id: string
  ): Promise<void> {
    if (await this.depositPosted(referrerId, campaign.currency, id)) {
      await this.finish(id, 'posted', null);
      return;
    }
    if (await this.capped(campaign, referrerId)) {
      await this.finish(id, 'skipped', 'referrer_cap_reached');
      return;
    }
    const outcome = await this.payWallet(referrerId, amount, campaign.currency, campaign.name, id);
    if (outcome === 'missing_hq') {
      await this.finish(id, 'skipped', 'hq_account_missing');
      return;
    }
    if (outcome !== 'paid') return;
    await this.finish(id, 'posted', null);
    await this.notifyReferrer(referrerId, amount, campaign.currency, id);
  }

  private async capped(campaign: CreditCampaign, referrerId: string): Promise<boolean> {
    const result = await this.hasura.executeQuery(POSTED_REFERRER, {
      campaignId: campaign.id,
      userId: referrerId,
    });
    const posted = result.credit_campaign_grants_aggregate?.aggregate?.count ?? 0;
    return referrerAtCap(posted, campaign.max_referrer_rewards);
  }

  private async load(country: string): Promise<CreditCampaign[]> {
    const result = await this.hasura.executeQuery(ACTIVE, {
      country,
      now: new Date().toISOString(),
    });
    return result.credit_campaigns ?? [];
  }

  private async openGrant(object: Record<string, unknown>): Promise<string | null> {
    const inserted = await this.hasura.executeMutation(CLAIM, { object });
    const created = inserted.insert_credit_campaign_grants_one?.id as string | undefined;
    if (created) return this.take(created);
    return this.takeExisting(object);
  }

  private async takeExisting(object: Record<string, unknown>): Promise<string | null> {
    const existing = await this.hasura.executeQuery(EXISTING, {
      campaignId: object.campaign_id,
      signupUserId: object.signup_user_id,
      role: object.beneficiary_role,
    });
    const row = existing.credit_campaign_grants?.[0];
    if (!row || row.status === 'posted' || row.status === 'skipped') return null;
    if (row.status === 'pending') return this.take(row.id);
    return this.reclaim(row);
  }

  private async reclaim(row: { id: string; updated_at?: string }): Promise<string | null> {
    const updated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    if (Date.now() - updated < STALE_POSTING_MS) return null;
    const now = new Date().toISOString();
    const staleBefore = new Date(Date.now() - STALE_POSTING_MS).toISOString();
    const result = await this.hasura.executeMutation(RECLAIM, { id: row.id, staleBefore, now });
    return result.update_credit_campaign_grants?.affected_rows === 1 ? row.id : null;
  }

  private async take(id: string): Promise<string | null> {
    const result = await this.hasura.executeMutation(TAKE, { id, now: new Date().toISOString() });
    return result.update_credit_campaign_grants?.affected_rows === 1 ? id : null;
  }

  private async finish(
    id: string,
    status: 'posted' | 'skipped',
    reason: string | null,
    grantId?: string | null
  ): Promise<void> {
    await this.hasura.executeMutation(FINISH, {
      id,
      status,
      reason,
      grantId: grantId ?? null,
    });
  }

  private async payWallet(
    userId: string,
    amount: number,
    currency: string,
    name: string,
    auditId: string
  ): Promise<'paid' | 'retry' | 'missing_hq'> {
    const hq = await this.hqAccount(currency);
    if (!hq) return 'missing_hq';
    const accountId = await this.ensurePersonal(userId, currency);
    const debit = await this.debitHqIfNeeded(hq, amount, name, auditId);
    if (debit === 'failed') return 'retry';
    const credited = await this.creditReferrer(accountId, amount, name, auditId);
    if (credited) return 'paid';
    if (debit === 'fresh') await this.reverseHq(hq, amount, name, auditId);
    return 'retry';
  }

  private async debitHqIfNeeded(
    hq: string,
    amount: number,
    name: string,
    auditId: string
  ): Promise<'ready' | 'fresh' | 'failed'> {
    const paid = await this.accounts.hasTransactionForReference({
      accountId: hq,
      transactionType: 'payment',
      referenceId: auditId,
    });
    const reversed = await this.accounts.hasTransactionForReference({
      accountId: hq,
      transactionType: 'deposit',
      referenceId: auditId,
    });
    if (paid && !reversed) return 'ready';
    const debit = await this.accounts.registerTransaction({
      accountId: hq,
      amount,
      transactionType: 'payment',
      memo: `Referral reward source - ${name}`,
      referenceId: auditId,
      allowNegative: true,
    });
    return debit.success ? 'fresh' : 'failed';
  }

  private async creditReferrer(
    accountId: string,
    amount: number,
    name: string,
    auditId: string
  ): Promise<boolean> {
    try {
      const credit = await this.accounts.registerTransaction({
        accountId,
        amount,
        transactionType: 'deposit',
        memo: `Referral reward - ${name}`,
        referenceId: auditId,
      });
      return credit.success;
    } catch (error: any) {
      this.logger.warn(`Referral wallet credit failed: ${error?.message ?? error}`);
      return false;
    }
  }

  private async depositPosted(userId: string, currency: string, auditId: string): Promise<boolean> {
    const existing = await this.hasura.executeQuery(PERSONAL, { userId, currency });
    const accountId = existing.accounts?.[0]?.id as string | undefined;
    if (!accountId) return false;
    return this.accounts.hasTransactionForReference({
      accountId,
      transactionType: 'deposit',
      referenceId: auditId,
    });
  }

  private async storeCreditId(userId: string, campaignId: string): Promise<string | null> {
    const result = await this.hasura.executeQuery(STORE_CREDIT, { userId, sourceId: campaignId });
    return result.purchase_credit_grants?.[0]?.id ?? null;
  }

  private async ensurePersonal(userId: string, currency: string): Promise<string> {
    const existing = await this.hasura.executeQuery(PERSONAL, { userId, currency });
    if (existing.accounts?.[0]?.id) return existing.accounts[0].id;
    const created = await this.hasura.executeMutation(INSERT_ACCOUNT, { userId, currency });
    return created.insert_accounts_one.id;
  }

  private async hqAccount(currency: string): Promise<string | null> {
    const result = await this.hasura.executeQuery(HQ, { currency });
    return result.users?.[0]?.accounts?.[0]?.id ?? null;
  }

  private async reverseHq(accountId: string, amount: number, name: string, auditId: string): Promise<void> {
    await this.accounts.registerTransaction({
      accountId,
      amount,
      transactionType: 'deposit',
      memo: `Referral reward reversal - ${name}`,
      referenceId: auditId,
      allowNegative: true,
    });
  }

  private async notifyReferrer(
    userId: string,
    amount: number,
    currency: string,
    entityId: string
  ): Promise<void> {
    const copy = campaignCashCopy({ amount, currency });
    await this.notifications.sendPaymentProgramNotice({
      userId,
      title: copy.title,
      body: copy.body,
      messageType: 'PAYMENT_SCHEDULE',
      entityId,
      path: '/accounts',
      event: 'wallet.referral_reward',
    });
  }
}

function subjectRow(campaign: CreditCampaign, event: SignupCampaignEvent, amount: number) {
  return claimRow(campaign, event, 'subject', event.userId, 'store', amount);
}

function referrerRow(campaign: CreditCampaign, event: SignupCampaignEvent, amount: number) {
  return claimRow(campaign, event, 'referrer', event.referrerUserId as string, 'wallet', amount);
}

function claimRow(
  campaign: CreditCampaign,
  event: SignupCampaignEvent,
  role: 'subject' | 'referrer',
  beneficiary: string,
  kind: 'store' | 'wallet',
  amount: number
) {
  return {
    campaign_id: campaign.id,
    signup_user_id: event.userId,
    beneficiary_user_id: beneficiary,
    beneficiary_role: role,
    credit_kind: kind,
    amount,
    currency: campaign.currency,
    status: 'pending',
  };
}

function subjectGrant(campaign: CreditCampaign, event: SignupCampaignEvent, amount: number) {
  return {
    userId: event.userId,
    currency: campaign.currency,
    amount,
    applicability: campaign.store_scope,
    businessId: campaign.business_id,
    expiresAt: creditExpiresAt(campaign.store_credit_expires_days),
    memo: campaign.name,
    sourceId: campaign.id,
  };
}

const ACTIVE = `
  query ActiveCreditCampaigns($country: String!, $now: timestamptz!) {
    credit_campaigns(where: {
      is_active: { _eq: true }
      event_type: { _eq: "signup" }
      country_code: { _eq: $country }
      starts_at: { _lte: $now }
      ends_at: { _gt: $now }
    }) {
      id name country_code persona currency store_scope business_id
      subject_amount subject_bonus_if_referred store_credit_expires_days
      referrer_amount max_referrer_rewards
    }
  }
`;

const CLAIM = `
  mutation ClaimCampaignGrant($object: credit_campaign_grants_insert_input!) {
    insert_credit_campaign_grants_one(
      object: $object
      on_conflict: { constraint: credit_campaign_grants_once, update_columns: [] }
    ) { id }
  }
`;

const EXISTING = `
  query ExistingCampaignGrant($campaignId: uuid!, $signupUserId: uuid!, $role: String!) {
    credit_campaign_grants(where: {
      campaign_id: { _eq: $campaignId }
      signup_user_id: { _eq: $signupUserId }
      beneficiary_role: { _eq: $role }
    }, limit: 1) { id status updated_at }
  }
`;

const RECLAIM = `
  mutation ReclaimCampaignGrant($id: uuid!, $staleBefore: timestamptz!, $now: timestamptz!) {
    update_credit_campaign_grants(
      where: {
        id: { _eq: $id }
        status: { _eq: "posting" }
        updated_at: { _lt: $staleBefore }
      }
      _set: { updated_at: $now }
    ) { affected_rows }
  }
`;

const TAKE = `
  mutation TakeCampaignGrant($id: uuid!, $now: timestamptz!) {
    update_credit_campaign_grants(
      where: { id: { _eq: $id }, status: { _eq: "pending" } }
      _set: { status: "posting", updated_at: $now }
    ) { affected_rows }
  }
`;

const STORE_CREDIT = `
  query CampaignStoreCredit($userId: uuid!, $sourceId: uuid!) {
    purchase_credit_grants(where: {
      user_id: { _eq: $userId }
      source: { _eq: campaign }
      source_id: { _eq: $sourceId }
    }, limit: 1) { id }
  }
`;

const FINISH = `
  mutation FinishCampaignGrant($id: uuid!, $status: String!, $reason: String, $grantId: uuid) {
    update_credit_campaign_grants_by_pk(
      pk_columns: { id: $id }
      _set: { status: $status, skip_reason: $reason, purchase_credit_grant_id: $grantId }
    ) { id }
  }
`;

const POSTED_REFERRER = `
  query PostedReferrerRewards($campaignId: uuid!, $userId: uuid!) {
    credit_campaign_grants_aggregate(where: {
      campaign_id: { _eq: $campaignId }
      beneficiary_user_id: { _eq: $userId }
      beneficiary_role: { _eq: "referrer" }
      status: { _eq: "posted" }
    }) { aggregate { count } }
  }
`;

const HQ = `
  query CampaignHqAccount($currency: currency_enum!) {
    users(where: { email: { _eq: "hq@rendasua.com" } }, limit: 1) {
      accounts(where: { currency: { _eq: $currency }, business_location_id: { _is_null: true } }, limit: 1) { id }
    }
  }
`;

const PERSONAL = `
  query CampaignPersonalAccount($userId: uuid!, $currency: currency_enum!) {
    accounts(where: {
      user_id: { _eq: $userId }
      currency: { _eq: $currency }
      business_location_id: { _is_null: true }
    }, limit: 1) { id }
  }
`;

const INSERT_ACCOUNT = `
  mutation InsertCampaignWallet($userId: uuid!, $currency: currency_enum!) {
    insert_accounts_one(object: {
      user_id: $userId
      currency: $currency
      available_balance: 0
      withheld_balance: 0
      is_active: true
    }) { id }
  }
`;
