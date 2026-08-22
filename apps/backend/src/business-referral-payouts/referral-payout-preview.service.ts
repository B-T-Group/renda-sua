import { Injectable } from '@nestjs/common';
import { ReferralPyramidService } from '../referrals/referral-pyramid.service';
import type { PayoutPreviewBeneficiary } from './referral-payout-preview.types';
import {
  BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
  BUSINESS_REFERRAL_PAYOUT_MIN_ITEMS,
} from './business-referral-payout.constants';
import { BusinessReferralPayoutsService } from './business-referral-payouts.service';
import { RepresentativeCompensationService } from '../representative-compensation/representative-compensation.service';
import type {
  PayoutPreviewRow,
  PayoutPreviewTotal,
  PreviewEligibleBusiness,
  PreviewGross,
  PreviewPendingClaim,
  WeeklyPayoutPreview,
} from './referral-payout-preview.types';

@Injectable()
export class ReferralPayoutPreviewService {
  constructor(
    private readonly payoutsService: BusinessReferralPayoutsService,
    private readonly referralPyramidService: ReferralPyramidService,
    private readonly representativeCompensationService: RepresentativeCompensationService
  ) {}

  async previewWeeklyPayouts(countryCode?: string): Promise<WeeklyPayoutPreview> {
    const enabled = await this.payoutsService.isPayoutFeatureEnabled();
    const percents = await this.referralPyramidService.getPyramidPercents();
    const rows = await this.collectRows(countryCode);
    return {
      enabled,
      cutoffDate: BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
      minItems: BUSINESS_REFERRAL_PAYOUT_MIN_ITEMS,
      percents,
      payableCount: rows.filter((r) => r.wouldCredit).length,
      skippedCount: rows.filter((r) => !r.wouldCredit).length,
      rows,
      totalsByCurrency: this.totals(rows),
    };
  }

  private async collectRows(countryCode?: string): Promise<PayoutPreviewRow[]> {
    const [pendingCompensation, pending] = await Promise.all([
      this.representativeCompensationService.previewPending(countryCode),
      this.payoutsService.listIncompleteClaimsForPreview(),
    ]);
    const eligible = pendingCompensation.map((row) => ({
      kind: row.earnerKind,
      id: row.businessId,
      name: row.businessName,
      itemCount: row.itemCount,
      earner: {
        kind: row.earnerKind,
        id: row.earnerId,
        userId: row.earnerUserId,
        name: row.earnerName,
      },
      pendingAmount: row.amount,
      pendingCurrency: row.currency,
      countryCode: row.countryCode,
    }));
    const eligibleRows = await this.buildEligibleRows(eligible, countryCode);
    const pendingRows = await this.buildPendingRows(pending, countryCode);
    return [...eligibleRows, ...pendingRows];
  }

  private async buildEligibleRows(
    eligible: PreviewEligibleBusiness[],
    countryCode?: string
  ): Promise<PayoutPreviewRow[]> {
    const rows: PayoutPreviewRow[] = [];
    for (const business of eligible) {
      const row = await this.previewOne(business);
      if (this.matchesCountry(row, countryCode)) rows.push(row);
    }
    return rows;
  }

  private async buildPendingRows(
    pending: PreviewPendingClaim[],
    countryCode?: string
  ): Promise<PayoutPreviewRow[]> {
    const rows: PayoutPreviewRow[] = [];
    for (const claim of pending) {
      const row = await this.previewPending(claim);
      if (this.matchesCountry(row, countryCode)) rows.push(row);
    }
    return rows;
  }

  private matchesCountry(row: PayoutPreviewRow, countryCode?: string): boolean {
    if (!countryCode) return true;
    return (row.countryCode ?? '').toUpperCase() === countryCode.toUpperCase();
  }

  private async previewOne(
    business: PreviewEligibleBusiness
  ): Promise<PayoutPreviewRow> {
    if (!business.earner) return this.skippedRow(business, 'no_referrer');
    const configured = await this.payoutsService.previewGrossForUser(
      business.earner.userId
    );
    const gross: PreviewGross = {
      countryCode: business.countryCode ?? configured.countryCode,
      currency: business.pendingCurrency ?? configured.currency,
      amount: business.pendingAmount ?? configured.amount,
      configKey: configured.configKey,
    };
    if (!gross.amount) {
      return this.skippedRow(business, 'no_amount', gross);
    }
    return this.withPyramid(business, gross, false);
  }

  private async previewPending(claim: PreviewPendingClaim): Promise<PayoutPreviewRow> {
    const business = this.pendingAsEligible(claim);
    if (!claim.earner) return this.skippedRow(business, 'no_referrer');
    const meta = await this.payoutsService.previewGrossForUser(claim.earner.userId);
    const gross: PreviewGross = {
      countryCode: meta.countryCode,
      currency: claim.currency,
      amount: claim.amount,
      configKey: meta.configKey,
    };
    return this.withPyramid(business, gross, true);
  }

  private pendingAsEligible(claim: PreviewPendingClaim): PreviewEligibleBusiness {
    return {
      kind: claim.referralKind,
      id: claim.referredBusinessId,
      name: claim.referredBusinessName,
      itemCount: 0,
      earner: claim.earner,
    };
  }

  private async withPyramid(
    business: PreviewEligibleBusiness,
    gross: PreviewGross,
    pendingRetry: boolean
  ): Promise<PayoutPreviewRow> {
    const earner = business.earner!;
    const preview = await this.referralPyramidService.previewBonusShares({
      grossAmount: gross.amount,
      earner,
      preferPersonalAccount: earner.kind === 'agent',
      currency: gross.currency,
    });
    return this.rowFromPyramid(business, gross, preview.shares, pendingRetry);
  }

  private rowFromPyramid(
    business: PreviewEligibleBusiness,
    gross: PreviewGross,
    shares: PayoutPreviewBeneficiary[],
    pendingRetry: boolean
  ): PayoutPreviewRow {
    const earnerShare = shares.find((s) => s.generation === 0);
    const skipReason = earnerShare && !earnerShare.hasAccount ? 'no_account' : null;
    return {
      ...this.baseRow(business, gross, pendingRetry),
      wouldCredit: !skipReason,
      skipReason,
      beneficiaries: shares,
    };
  }

  private skippedRow(
    business: PreviewEligibleBusiness,
    skipReason: 'no_referrer' | 'no_amount',
    gross?: PreviewGross
  ): PayoutPreviewRow {
    return {
      ...this.baseRow(business, gross, false),
      wouldCredit: false,
      skipReason,
      beneficiaries: [],
    };
  }

  private baseRow(
    business: PreviewEligibleBusiness,
    gross: PreviewGross | undefined,
    pendingRetry: boolean
  ): Omit<PayoutPreviewRow, 'wouldCredit' | 'skipReason' | 'beneficiaries'> {
    return {
      referredBusinessId: business.id,
      referredBusinessName: business.name,
      itemCount: business.itemCount,
      referralKind: business.kind,
      countryCode: gross?.countryCode ?? null,
      currency: gross?.currency ?? 'XAF',
      grossAmount: gross?.amount ?? 0,
      payoutConfigKey: gross?.configKey ?? null,
      pendingRetry,
      referrer: business.earner,
    };
  }

  private totals(rows: PayoutPreviewRow[]): PayoutPreviewTotal[] {
    const map = new Map<string, PayoutPreviewTotal>();
    for (const row of rows) {
      if (!row.wouldCredit) continue;
      const current = map.get(row.currency) ?? {
        currency: row.currency,
        count: 0,
        gross: 0,
      };
      current.count += 1;
      current.gross += row.grossAmount;
      map.set(row.currency, current);
    }
    return [...map.values()];
  }
}
