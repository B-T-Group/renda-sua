import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { ConfigurationsService } from '../admin/configurations.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BonusShareAmount,
  buildReferralBonusMemo,
  PyramidPercents,
  ReferralEntityKind,
  ReferralEntityRef,
  referralReferenceUuid,
  splitReferralBonus,
} from './referral-pyramid.util';

export interface PreviewBonusShare {
  generation: number;
  kind: ReferralEntityKind;
  id: string;
  userId: string;
  name: string;
  amount: number;
  percent: number | null;
  hasAccount: boolean;
}

export interface DistributeReferralBonusInput {
  grossAmount: number;
  earner: ReferralEntityRef;
  referred: {
    kind: ReferralEntityKind;
    id: string;
    name: string;
  };
  /** Prefer personal account for agents; business location account for businesses. */
  preferPersonalAccount: boolean;
  currency: string;
  businessReferralPayoutId?: string;
  agentReferralId?: string;
  compensationEventId?: string;
}

@Injectable()
export class ReferralPyramidService {
  private readonly logger = new Logger(ReferralPyramidService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly accountsService: AccountsService,
    private readonly configurationsService: ConfigurationsService,
    private readonly notificationsService: NotificationsService
  ) {}

  async getPyramidPercents(): Promise<PyramidPercents> {
    const [g1, g2, g3] = await Promise.all([
      this.readPercent('referral_pyramid_gen1_percent', 5),
      this.readPercent('referral_pyramid_gen2_percent', 3),
      this.readPercent('referral_pyramid_gen3_percent', 1),
    ]);
    return { gen1: g1, gen2: g2, gen3: g3 };
  }

  async resolveUpline(
    earner: ReferralEntityRef,
    depth = 3
  ): Promise<ReferralEntityRef[]> {
    const upline: ReferralEntityRef[] = [];
    let current: ReferralEntityRef | null = earner;
    for (let i = 0; i < depth; i++) {
      if (!current) break;
      const parent = await this.fetchParent(current);
      if (!parent) break;
      upline.push(parent);
      current = parent;
    }
    return upline;
  }

  async distributeReferralBonus(
    input: DistributeReferralBonusInput
  ): Promise<{ credited: number; transactionIds: string[] }> {
    if (
      !input.businessReferralPayoutId &&
      !input.agentReferralId &&
      !input.compensationEventId
    ) {
      throw new Error('Distribution source payout/referral id is required');
    }
    if (input.grossAmount <= 0) {
      return { credited: 0, transactionIds: [] };
    }

    const percents = await this.getPyramidPercents();
    const upline = await this.resolveUpline(input.earner, 3);
    const amounts = splitReferralBonus(
      input.grossAmount,
      percents,
      upline.length
    );

    const transactionIds: string[] = [];
    let credited = 0;
    let earnerCredited = false;
    const earnerShare = amounts.find((s) => s.generation === 0);
    for (const share of amounts) {
      const beneficiary =
        share.generation === 0 ? input.earner : upline[share.generation - 1];
      if (!beneficiary) continue;

      const credit = await this.creditShare({
        share,
        beneficiary,
        earner: input.earner,
        referred: input.referred,
        percents,
        preferPersonalAccount:
          beneficiary.kind === 'agent' ? true : input.preferPersonalAccount,
        currency: input.currency,
        businessReferralPayoutId: input.businessReferralPayoutId,
        agentReferralId: input.agentReferralId,
        compensationEventId: input.compensationEventId,
      });
      if (credit) {
        transactionIds.push(credit.transactionId);
        credited++;
        if (share.generation === 0) earnerCredited = true;
        if (credit.createdNewDeposit) {
          await this.notifyBeneficiary(
            beneficiary,
            share,
            input.referred,
            input.currency
          );
        }
      }
    }
    if (earnerShare && earnerShare.amount > 0 && !earnerCredited) {
      throw new Error(
        `Referral earner ${input.earner.kind} ${input.earner.id} could not be credited`
      );
    }
    return { credited, transactionIds };
  }

  async previewBonusShares(params: {
    grossAmount: number;
    earner: ReferralEntityRef;
    preferPersonalAccount: boolean;
    currency: string;
  }): Promise<{ percents: PyramidPercents; shares: PreviewBonusShare[] }> {
    const percents = await this.getPyramidPercents();
    const upline = await this.resolveUpline(params.earner, 3);
    const amounts = splitReferralBonus(
      params.grossAmount,
      percents,
      upline.length
    );
    const shares = await Promise.all(
      amounts.map((share) => this.mapPreviewShare(share, params, percents, upline))
    );
    return { percents, shares };
  }

  private async mapPreviewShare(
    share: BonusShareAmount,
    params: {
      earner: ReferralEntityRef;
      preferPersonalAccount: boolean;
      currency: string;
    },
    percents: PyramidPercents,
    upline: ReferralEntityRef[]
  ): Promise<PreviewBonusShare> {
    const beneficiary =
      share.generation === 0 ? params.earner : upline[share.generation - 1];
    const hasAccount = await this.previewHasAccount(
      beneficiary,
      params.currency,
      beneficiary?.kind === 'agent' ? true : params.preferPersonalAccount
    );
    return {
      generation: share.generation,
      kind: beneficiary?.kind ?? params.earner.kind,
      id: beneficiary?.id ?? '',
      userId: beneficiary?.userId ?? '',
      name: beneficiary?.name ?? '',
      amount: share.amount,
      percent: this.sharePercent(share.generation, percents),
      hasAccount,
    };
  }

  private sharePercent(
    generation: 0 | 1 | 2 | 3,
    percents: PyramidPercents
  ): number | null {
    if (generation === 0) return null;
    return [percents.gen1, percents.gen2, percents.gen3][generation - 1] ?? null;
  }

  private async previewHasAccount(
    beneficiary: ReferralEntityRef | undefined,
    currency: string,
    preferPersonalAccount: boolean
  ): Promise<boolean> {
    if (!beneficiary) return false;
    const accountId = await this.resolveAccountId(
      beneficiary,
      currency,
      preferPersonalAccount
    );
    return Boolean(accountId);
  }

  private async creditShare(params: {
    share: BonusShareAmount;
    beneficiary: ReferralEntityRef;
    earner: ReferralEntityRef;
    referred: { kind: ReferralEntityKind; id: string; name: string };
    percents: PyramidPercents;
    preferPersonalAccount: boolean;
    currency: string;
    businessReferralPayoutId?: string;
    agentReferralId?: string;
    compensationEventId?: string;
  }): Promise<{ transactionId: string; createdNewDeposit: boolean } | null> {
    const generation = params.share.generation;
    const existing = await this.findExistingDistribution({
      generation,
      businessReferralPayoutId: params.businessReferralPayoutId,
      agentReferralId: params.agentReferralId,
      compensationEventId: params.compensationEventId,
    });
    if (existing?.transaction_id) {
      return { transactionId: existing.transaction_id, createdNewDeposit: false };
    }

    const accountId = await this.resolveAccountId(
      params.beneficiary,
      params.currency,
      params.preferPersonalAccount
    );
    if (!accountId) {
      this.logger.warn(
        `No ${params.currency} account for ${params.beneficiary.kind} ${params.beneficiary.id} gen${generation}`
      );
      return null;
    }

    const percent =
      generation === 0
        ? undefined
        : ([params.percents.gen1, params.percents.gen2, params.percents.gen3][
            generation - 1
          ] as number);
    const memo = buildReferralBonusMemo({
      generation,
      percent,
      earnerName: params.earner.name,
      referredKind: params.referred.kind,
      referredName: params.referred.name,
      referredId: params.referred.id,
    });
    const sourceKey = params.compensationEventId
      ? `comp:${params.compensationEventId}`
      : `ref:${params.referred.kind}:${params.referred.id}`;
    const textReference = `${sourceKey}:gen${generation}`;
    const referenceId = referralReferenceUuid(textReference);

    let prior:
      | { id: string; account_id?: string }
      | null =
      (await this.accountsService.findDepositByReference(
        accountId,
        referenceId
      )) ??
      (await this.accountsService.findDepositByReferenceId(referenceId));
    if (
      !prior &&
      !params.compensationEventId &&
      generation === 0 &&
      (params.referred.kind === 'business' || params.referred.kind === 'agent')
    ) {
      prior = await this.accountsService.findDepositByReferenceId(
        params.referred.id
      );
    }
    let transactionId = prior?.id ?? null;
    let createdNewDeposit = false;
    if (!transactionId) {
      const txResult = await this.accountsService.registerTransaction({
        accountId,
        amount: params.share.amount,
        transactionType: 'deposit',
        memo,
        referenceId,
      });
      if (!txResult.success || !txResult.transactionId) {
        throw new Error(
          txResult.error ||
            `Failed to credit referral share gen${generation} for ${params.beneficiary.id}`
        );
      }
      transactionId = txResult.transactionId;
      createdNewDeposit = true;
    }

    await this.insertDistributionRow({
      generation,
      amount: params.share.amount,
      memo,
      referenceId: textReference,
      accountId: prior?.account_id ?? accountId,
      transactionId,
      beneficiary: params.beneficiary,
      businessReferralPayoutId: params.businessReferralPayoutId,
      agentReferralId: params.agentReferralId,
      compensationEventId: params.compensationEventId,
    });

    return { transactionId, createdNewDeposit };
  }

  private async readPercent(key: string, fallback: number): Promise<number> {
    try {
      const config = await this.configurationsService.getConfigurationByKey(key);
      const value = Number(config?.number_value);
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    } catch (error: any) {
      this.logger.warn(`Failed to read ${key}: ${error.message}`);
      return fallback;
    }
  }

  private async fetchParent(
    entity: ReferralEntityRef
  ): Promise<ReferralEntityRef | null> {
    if (entity.kind === 'agent') {
      const query = `
        query AgentReferralParent($id: uuid!) {
          agents_by_pk(id: $id) {
            referred_by_agent_id
            referred_by_business_id
            referring_agent {
              id
              user_id
              user { first_name last_name }
            }
            referring_business {
              id
              name
              user_id
            }
          }
        }
      `;
      const result = await this.hasuraSystemService.executeQuery(query, {
        id: entity.id,
      });
      const row = result?.agents_by_pk;
      if (row?.referring_agent?.id) {
        const u = row.referring_agent.user;
        return {
          kind: 'agent',
          id: row.referring_agent.id,
          userId: row.referring_agent.user_id,
          name: `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || 'Agent',
        };
      }
      if (row?.referring_business?.id) {
        return {
          kind: 'business',
          id: row.referring_business.id,
          userId: row.referring_business.user_id,
          name: row.referring_business.name || 'Business',
        };
      }
      return null;
    }

    const query = `
      query BusinessReferralParent($id: uuid!) {
        businesses_by_pk(id: $id) {
          referred_by_agent_id
          referred_by_business_id
          referring_agent {
            id
            user_id
            user { first_name last_name }
          }
          referring_business {
            id
            name
            user_id
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      id: entity.id,
    });
    const row = result?.businesses_by_pk;
    if (row?.referring_agent?.id) {
      const u = row.referring_agent.user;
      return {
        kind: 'agent',
        id: row.referring_agent.id,
        userId: row.referring_agent.user_id,
        name: `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || 'Agent',
      };
    }
    if (row?.referring_business?.id) {
      return {
        kind: 'business',
        id: row.referring_business.id,
        userId: row.referring_business.user_id,
        name: row.referring_business.name || 'Business',
      };
    }
    return null;
  }

  private async resolveAccountId(
    beneficiary: ReferralEntityRef,
    currency: string,
    preferPersonalAccount: boolean
  ): Promise<string | null> {
    if (beneficiary.kind === 'agent' || preferPersonalAccount) {
      return this.findPersonalAccountId(beneficiary.userId, currency);
    }
    const businessAccount = await this.findBusinessAccountId(
      beneficiary.id,
      beneficiary.userId,
      currency
    );
    return (
      businessAccount ??
      this.findPersonalAccountId(beneficiary.userId, currency)
    );
  }

  private async findPersonalAccountId(
    userId: string,
    currency: string
  ): Promise<string | null> {
    const query = `
      query PyramidPersonalAccount($userId: uuid!, $currency: currency_enum!) {
        accounts(
          where: {
            user_id: { _eq: $userId }
            is_active: { _eq: true }
            currency: { _eq: $currency }
            business_location_id: { _is_null: true }
          }
          limit: 1
        ) { id }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        userId,
        currency,
      });
      return result?.accounts?.[0]?.id ?? null;
    } catch (error: any) {
      this.logger.error(
        `Failed to find personal account for ${userId}: ${error.message}`
      );
      return null;
    }
  }

  private async findBusinessAccountId(
    businessId: string,
    userId: string,
    currency: string
  ): Promise<string | null> {
    const query = `
      query PyramidBusinessAccount(
        $businessId: uuid!
        $userId: uuid!
        $currency: currency_enum!
      ) {
        accounts(
          where: {
            user_id: { _eq: $userId }
            is_active: { _eq: true }
            currency: { _eq: $currency }
            business_location: { business_id: { _eq: $businessId } }
          }
          limit: 1
        ) { id }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        businessId,
        userId,
        currency,
      });
      return result?.accounts?.[0]?.id ?? null;
    } catch (error: any) {
      this.logger.error(
        `Failed to find business account for ${businessId}: ${error.message}`
      );
      return null;
    }
  }

  private async findExistingDistribution(params: {
    generation: number;
    businessReferralPayoutId?: string;
    agentReferralId?: string;
    compensationEventId?: string;
  }): Promise<{ transaction_id: string | null } | null> {
    const queryName = params.compensationEventId
      ? 'ExistingCompDist'
      : params.businessReferralPayoutId
        ? 'ExistingBizDist'
        : 'ExistingAgentDist';
    const filter = params.compensationEventId
      ? 'compensation_event_id: { _eq: $sourceId }'
      : params.businessReferralPayoutId
        ? 'business_referral_payout_id: { _eq: $sourceId }'
        : 'agent_referral_id: { _eq: $sourceId }';
    const query = `
      query ${queryName}($sourceId: uuid!, $generation: smallint!) {
        referral_bonus_distributions(
          where: { ${filter}, generation: { _eq: $generation } }
          limit: 1
        ) { transaction_id }
      }
    `;
    const sourceId =
      params.compensationEventId ??
      params.businessReferralPayoutId ??
      params.agentReferralId;
    if (!sourceId) return null;
    const result = await this.hasuraSystemService.executeQuery(query, {
      sourceId,
      generation: params.generation,
    });
    return result?.referral_bonus_distributions?.[0] ?? null;
  }

  private async insertDistributionRow(params: {
    generation: number;
    amount: number;
    memo: string;
    referenceId: string;
    accountId: string;
    transactionId: string;
    beneficiary: ReferralEntityRef;
    businessReferralPayoutId?: string;
    agentReferralId?: string;
    compensationEventId?: string;
  }): Promise<void> {
    const mutation = `
      mutation InsertReferralBonusDistribution(
        $input: referral_bonus_distributions_insert_input!
      ) {
        insert_referral_bonus_distributions_one(object: $input) { id }
      }
    `;
    const input: Record<string, unknown> = {
      generation: params.generation,
      amount: params.amount,
      memo: params.memo,
      reference_id: params.referenceId,
      account_id: params.accountId,
      transaction_id: params.transactionId,
      business_referral_payout_id: params.businessReferralPayoutId ?? null,
      agent_referral_id: params.agentReferralId ?? null,
      compensation_event_id: params.compensationEventId ?? null,
      beneficiary_agent_id:
        params.beneficiary.kind === 'agent' ? params.beneficiary.id : null,
      beneficiary_business_id:
        params.beneficiary.kind === 'business' ? params.beneficiary.id : null,
    };
    try {
      await this.hasuraSystemService.executeMutation(mutation, { input });
    } catch (error: any) {
      if (this.isUniqueViolation(error)) {
        this.logger.warn(
          `Distribution row already exists for ${params.referenceId}`
        );
        return;
      }
      throw error;
    }
  }

  private isUniqueViolation(error: any): boolean {
    const message = String(error?.message || error || '').toLowerCase();
    return (
      message.includes('uniqueness violation') ||
      message.includes('unique constraint') ||
      message.includes('uq_referral_bonus_distributions')
    );
  }

  private async notifyBeneficiary(
    beneficiary: ReferralEntityRef,
    share: BonusShareAmount,
    referred: { kind: ReferralEntityKind; name: string },
    currency: string
  ): Promise<void> {
    try {
      const user = await this.fetchUserLanguage(beneficiary.userId);
      const isFr = (user ?? 'en').toLowerCase().startsWith('fr');
      const title = isFr ? 'Crédit de parrainage' : 'Referral credit';
      const body = isFr
        ? `Crédit de parrainage (${referred.name}) — ${share.amount} ${currency}`
        : `Referral credit (${referred.name}) — ${share.amount} ${currency}`;
      await this.notificationsService.sendInternalPushByUserId(
        beneficiary.userId,
        title,
        body,
        {
          url: '/accounts',
          event: 'referral_pyramid_credit',
          generation: String(share.generation),
        }
      );
    } catch (error: any) {
      this.logger.warn(
        `Push failed for ${beneficiary.userId}: ${error.message}`
      );
    }
  }

  private async fetchUserLanguage(userId: string): Promise<string> {
    const query = `
      query UserLang($id: uuid!) {
        users_by_pk(id: $id) { preferred_language }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      id: userId,
    });
    return result?.users_by_pk?.preferred_language ?? 'en';
  }
}
