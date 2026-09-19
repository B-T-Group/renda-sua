import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreditCampaignRunnerService } from './credit-campaign-runner.service';
import { PurchaseCreditsService } from './purchase-credits.service';

const campaign = {
  id: 'camp',
  name: 'CM signup',
  persona: 'client',
  currency: 'XAF',
  store_scope: 'specific_business',
  business_id: 'biz',
  subject_amount: 500,
  subject_bonus_if_referred: 250,
  referrer_amount: 250,
  max_referrer_rewards: 5,
};

const event = {
  userId: 'signup-user',
  personas: ['client'],
  country: 'CM',
  referrerUserId: 'referrer-user',
};

describe('CreditCampaignRunnerService', () => {
  let hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };
  let accounts: { registerTransaction: jest.Mock; hasTransactionForReference: jest.Mock };
  let credits: { grantCampaign: jest.Mock };
  let notifications: { sendPaymentProgramNotice: jest.Mock };
  let service: CreditCampaignRunnerService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    accounts = {
      registerTransaction: jest.fn().mockResolvedValue({ success: true }),
      hasTransactionForReference: jest.fn().mockResolvedValue(false),
    };
    credits = { grantCampaign: jest.fn().mockResolvedValue({ id: 'store-grant' }) };
    notifications = { sendPaymentProgramNotice: jest.fn() };
    service = new CreditCampaignRunnerService(
      hasura as unknown as HasuraSystemService,
      accounts as unknown as AccountsService,
      credits as unknown as PurchaseCreditsService,
      notifications as unknown as NotificationsService
    );
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ActiveCreditCampaigns')) return { credit_campaigns: [campaign] };
      if (query.includes('PostedReferrerRewards')) {
        return { credit_campaign_grants_aggregate: { aggregate: { count: 0 } } };
      }
      if (query.includes('CampaignHqAccount')) return { users: [{ accounts: [{ id: 'hq' }] }] };
      if (query.includes('CampaignPersonalAccount')) return { accounts: [{ id: 'wallet' }] };
      return { credit_campaign_grants: [] };
    });
    hasura.executeMutation.mockImplementation(async (query: string, vars: any) => {
      if (query.includes('ClaimCampaignGrant')) return { insert_credit_campaign_grants_one: { id: vars.object.beneficiary_role } };
      if (query.includes('TakeCampaignGrant')) return { update_credit_campaign_grants: { affected_rows: 1 } };
      return { update_credit_campaign_grants_by_pk: { id: vars.id } };
    });
  });

  it('stops referrer cash at the cap and still grants the referred store bonus', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ActiveCreditCampaigns')) return { credit_campaigns: [campaign] };
      if (query.includes('PostedReferrerRewards')) {
        return { credit_campaign_grants_aggregate: { aggregate: { count: 5 } } };
      }
      return {};
    });
    await service.applySignup(event);
    expect(credits.grantCampaign).toHaveBeenCalledWith(expect.objectContaining({ amount: 750 }));
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
    const skipped = hasura.executeMutation.mock.calls.find(
      (call) => call[0].includes('FinishCampaignGrant') && call[1].reason === 'referrer_cap_reached'
    );
    expect(skipped).toBeTruthy();
  });

  it('does not grant again when the audit row is already posted', async () => {
    hasura.executeMutation.mockImplementation(async (query: string) => {
      if (query.includes('ClaimCampaignGrant')) return { insert_credit_campaign_grants_one: null };
      return {};
    });
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ActiveCreditCampaigns')) return { credit_campaigns: [campaign] };
      if (query.includes('ExistingCampaignGrant')) {
        return { credit_campaign_grants: [{ id: 'done', status: 'posted' }] };
      }
      return {};
    });
    await service.applySignup(event);
    expect(credits.grantCampaign).not.toHaveBeenCalled();
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
  });

  it('skips an inactive specific store and still pays the referrer', async () => {
    credits.grantCampaign.mockResolvedValue({ skipped: 'partner_inactive' });
    await service.applySignup(event);
    const skipped = hasura.executeMutation.mock.calls.find(
      (call) => call[0].includes('FinishCampaignGrant') && call[1].reason === 'partner_inactive'
    );
    expect(skipped).toBeTruthy();
    expect(accounts.registerTransaction).toHaveBeenCalled();
    expect(notifications.sendPaymentProgramNotice).toHaveBeenCalled();
  });

  it('finishes a stale posting grant without granting the store credit twice', async () => {
    const stale = new Date(Date.now() - 120_000).toISOString();
    hasura.executeMutation.mockImplementation(async (query: string, vars: any) => {
      if (query.includes('ClaimCampaignGrant')) return { insert_credit_campaign_grants_one: null };
      if (query.includes('ReclaimCampaignGrant')) {
        return { update_credit_campaign_grants: { affected_rows: 1 } };
      }
      if (query.includes('InsertCampaignWallet')) return { insert_accounts_one: { id: 'wallet' } };
      return { update_credit_campaign_grants_by_pk: { id: vars.id } };
    });
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ActiveCreditCampaigns')) return { credit_campaigns: [campaign] };
      if (query.includes('ExistingCampaignGrant')) {
        return { credit_campaign_grants: [{ id: 'stuck', status: 'posting', updated_at: stale }] };
      }
      if (query.includes('CampaignStoreCredit')) return { purchase_credit_grants: [{ id: 'store-grant' }] };
      if (query.includes('PostedReferrerRewards')) {
        return { credit_campaign_grants_aggregate: { aggregate: { count: 0 } } };
      }
      if (query.includes('CampaignHqAccount')) return { users: [{ accounts: [{ id: 'hq' }] }] };
      return { accounts: [] };
    });
    await service.applySignup(event);
    expect(credits.grantCampaign).not.toHaveBeenCalled();
    const posted = hasura.executeMutation.mock.calls.find(
      (call) => call[0].includes('FinishCampaignGrant') && call[1].grantId === 'store-grant'
    );
    expect(posted).toBeTruthy();
  });

  it('leaves a fresh posting grant to the worker that claimed it', async () => {
    hasura.executeMutation.mockImplementation(async (query: string) => {
      if (query.includes('ClaimCampaignGrant')) return { insert_credit_campaign_grants_one: null };
      return {};
    });
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ActiveCreditCampaigns')) return { credit_campaigns: [campaign] };
      if (query.includes('ExistingCampaignGrant')) {
        return {
          credit_campaign_grants: [{ id: 'busy', status: 'posting', updated_at: new Date().toISOString() }],
        };
      }
      return {};
    });
    await service.applySignup(event);
    expect(credits.grantCampaign).not.toHaveBeenCalled();
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
  });
});
