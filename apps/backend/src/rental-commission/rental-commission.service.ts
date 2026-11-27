import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { normalizeFeeCountryCode } from '../orders/fee-percent.util';
import { assertLedgerResult, rentalLedgerKey } from '../rentals/rental-ledger';
import { isActivePersona } from '../users/persona.util';
import {
  COMMISSION_BASIS,
  COMMISSION_CALC_VERSION,
  COMMISSION_ROUNDING,
  calculateRentalCommission,
  fromMinorUnits,
  toMinorUnits,
} from './rental-commission.calculator';
import { RentalCommissionRulesService } from './rental-commission-rules.service';
import * as Q from './rental-commission.queries';
import {
  CommissionBookingFields,
  CommissionQuote,
  CommissionQuoteInput,
  CommissionRuleContext,
} from './rental-commission.types';

export interface CommissionBookingRow extends CommissionBookingFields {
  currency: string;
  [key: string]: unknown;
}

/** Freezes, previews, settles and reports the rental commission. Rates come from the rules service. */
@Injectable()
export class RentalCommissionService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly accounts: AccountsService,
    private readonly rules: RentalCommissionRulesService
  ) {}

  /** Quote input for a request row loaded by the rentals service. */
  quoteInputFromRequest(req: any, total: number, currency: string): CommissionQuoteInput {
    const item = req.rental_location_listing?.rental_item;
    return {
      businessId: item?.business_id,
      categoryId: item?.rental_category_id ?? null,
      country: normalizeFeeCountryCode(req.rental_location_listing?.business_location?.address?.country),
      currency,
      total,
    };
  }

  /** Null when the commission flag is off for the market. */
  async quote(input: CommissionQuoteInput, at: Date = new Date()): Promise<CommissionQuote | null> {
    if (!(await this.rules.isEnabled(input.country))) return null;
    const ctx: CommissionRuleContext = { businessId: input.businessId, categoryId: input.categoryId, country: input.country };
    const rate = await this.rules.resolve(ctx, at);
    const split = calculateRentalCommission(input.total, rate.rateBps, input.currency);
    return {
      ...input,
      rate,
      baseAmount: split.baseAmount,
      commissionAmount: split.commissionAmount,
      merchantPayoutAmount: split.merchantPayoutAmount,
    };
  }

  /** The merchant must have seen the rate they accept. Omitted by older clients, which skip the check. */
  assertAcknowledged(quote: CommissionQuote | null, acknowledgedBps?: number | null): void {
    if (!quote || acknowledgedBps == null || acknowledgedBps === quote.rate.rateBps) return;
    throw new HttpException(
      {
        message: 'The commission rate changed. Review it and confirm again.',
        code: 'COMMISSION_RATE_CHANGED',
        currentRateBps: quote.rate.rateBps,
        commissionAmount: quote.commissionAmount,
        merchantPayoutAmount: quote.merchantPayoutAmount,
      },
      HttpStatus.CONFLICT
    );
  }

  async freeze(bookingId: string, quote: CommissionQuote | null, at: Date = new Date()): Promise<void> {
    if (!quote) return;
    const ruleId = await this.rules.persistPendingPromo(quote, quote.rate, at);
    const set = {
      commission_status: 'quoted',
      commission_rate_bps: quote.rate.rateBps,
      commission_basis: COMMISSION_BASIS,
      commission_base_amount: quote.baseAmount,
      commission_amount: quote.commissionAmount,
      merchant_payout_amount: quote.merchantPayoutAmount,
      commission_rounding: COMMISSION_ROUNDING,
      commission_rule_id: ruleId,
      commission_source: quote.rate.source,
      commission_campaign_code: quote.rate.campaignCode,
      commission_calc_version: COMMISSION_CALC_VERSION,
      commission_quoted_at: at.toISOString(),
    };
    await this.hasura.executeMutation(Q.FREEZE_BOOKING_COMMISSION, { id: bookingId, set });
  }

  /** Commission to withhold from `collected`. Zero for legacy or waived bookings. Capped at what was collected. */
  commissionFor(booking: CommissionBookingFields, collected: number): number {
    if (booking.commission_status !== 'quoted' || booking.commission_rate_bps == null) return 0;
    const split = calculateRentalCommission(booking.total_amount ?? 0, booking.commission_rate_bps, booking.currency);
    return Math.min(split.commissionAmount, collected);
  }

  netOfCommission(collected: number, commission: number, currency: string): number {
    return fromMinorUnits(toMinorUnits(collected, currency) - toMinorUnits(commission, currency), currency);
  }

  /** Pays the commission to HQ and records both audit rows. Idempotent per booking leg. */
  async settle(booking: CommissionBookingFields, commission: number, merchantAmount: number, leg: string): Promise<void> {
    if (commission <= 0) return;
    const hq = await this.hasura.getRendasuaHQUser();
    if (!hq) throw new HttpException('HQ account not configured', HttpStatus.BAD_GATEWAY);
    const hqAccount = await this.hasura.getAccount(hq.id, booking.currency);
    const credited = await this.accounts.registerTransaction({
      accountId: hqAccount.id,
      amount: commission,
      transactionType: 'deposit',
      memo: `Rental commission ${booking.id}`,
      referenceId: booking.id,
      idempotencyKey: rentalLedgerKey(booking.id, `${leg}:commission`),
    });
    assertLedgerResult(credited, `${leg} commission`);
    await this.recordEarned(booking, hq.id, commission, merchantAmount, credited.transactionId);
  }

  private async recordEarned(
    booking: CommissionBookingFields,
    hqUserId: string,
    commission: number,
    merchantAmount: number,
    transactionId?: string
  ): Promise<void> {
    await this.insertPayout(booking, 'rendasua', hqUserId, 'rental_commission', commission, transactionId);
    const merchantUserId = booking.business?.user_id;
    if (merchantUserId) {
      await this.insertPayout(booking, 'business', merchantUserId, 'rental_merchant_payout', merchantAmount);
    }
    await this.hasura.executeMutation(Q.SET_BOOKING_COMMISSION_STATUS, {
      id: booking.id,
      from: ['quoted'],
      set: {
        commission_status: 'earned',
        commission_earned_at: new Date().toISOString(),
        commission_earned_amount: commission,
      },
    });
  }

  private async insertPayout(
    booking: CommissionBookingFields,
    recipientType: string,
    recipientUserId: string,
    commissionType: string,
    amount: number,
    transactionId?: string
  ): Promise<void> {
    await this.hasura.executeMutation(Q.INSERT_RENTAL_COMMISSION_PAYOUT, {
      object: {
        rental_booking_id: booking.id,
        recipient_user_id: recipientUserId,
        recipient_type: recipientType,
        commission_type: commissionType,
        amount,
        currency: booking.currency,
        commission_percentage: booking.commission_rate_bps != null ? booking.commission_rate_bps / 100 : null,
        commission_rate_bps: booking.commission_rate_bps ?? null,
        account_transaction_id: transactionId ?? null,
      },
    });
  }

  /** Business-only view. The renter never sees these fields. */
  merchantEarnings(booking: CommissionBookingFields | null | undefined) {
    if (!booking || booking.commission_status === 'not_applicable' || booking.commission_status == null) return null;
    return {
      status: booking.commission_status,
      currency: booking.currency,
      rate_bps: booking.commission_rate_bps ?? null,
      base_amount: booking.commission_base_amount != null ? Number(booking.commission_base_amount) : null,
      commission_amount: booking.commission_amount != null ? Number(booking.commission_amount) : null,
      merchant_payout_amount: booking.merchant_payout_amount != null ? Number(booking.merchant_payout_amount) : null,
      commission_campaign_code: (booking as any).commission_campaign_code ?? null,
    };
  }

  async merchantEarningsForBooking(bookingId: string) {
    const res = await this.hasura.executeQuery<{ rental_bookings_by_pk: CommissionBookingRow | null }>(
      `query RentalMerchantEarnings($id: uuid!) {
        rental_bookings_by_pk(id: $id) {
          id currency commission_status commission_rate_bps commission_base_amount commission_amount
          merchant_payout_amount commission_campaign_code
        }
      }`,
      { id: bookingId }
    );
    return this.merchantEarnings(res.rental_bookings_by_pk);
  }

  async previewForBusiness(requestId: string, totalOverride?: number) {
    const user = await this.hasuraUser.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Only businesses can preview commission', HttpStatus.FORBIDDEN);
    }
    const req = await this.loadRequest(requestId);
    const item = req.rental_location_listing?.rental_item;
    if (item?.business_id !== user.business.id) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    const total = this.previewTotal(req, totalOverride);
    const currency = String(item.currency ?? req.rental_pricing_snapshot?.currency ?? '');
    const quote = await this.quote(this.quoteInputFromRequest(req, total, currency));
    return this.previewBody(quote, currency, total);
  }

  private async loadRequest(requestId: string) {
    const res = await this.hasura.executeQuery<{ rental_requests_by_pk: any }>(Q.COMMISSION_REQUEST_CONTEXT, { id: requestId });
    if (!res.rental_requests_by_pk) throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
    return res.rental_requests_by_pk;
  }

  private previewTotal(req: any, override?: number): number {
    const total = override != null && override > 0 ? override : Number(req.quoted_total ?? req.rental_pricing_snapshot?.total);
    if (!Number.isFinite(total) || total <= 0) throw new HttpException('Request has no quoted total', HttpStatus.CONFLICT);
    return total;
  }

  private previewBody(quote: CommissionQuote | null, currency: string, total: number) {
    if (!quote) return { enabled: false, currency, base_amount: total, rate_bps: 0, commission_amount: 0, merchant_payout_amount: total };
    return {
      enabled: true,
      currency,
      base_amount: quote.baseAmount,
      rate_bps: quote.rate.rateBps,
      commission_amount: quote.commissionAmount,
      merchant_payout_amount: quote.merchantPayoutAmount,
      source: quote.rate.source,
      campaign_code: quote.rate.campaignCode,
      promo_ends_at: quote.rate.promoEndsAt ?? null,
    };
  }

  async businessSummary() {
    const user = await this.hasuraUser.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Only businesses can view commission', HttpStatus.FORBIDDEN);
    }
    const res = await this.hasura.executeQuery<{ rental_bookings: any[] }>(Q.BUSINESS_COMMISSION_SUMMARY, {
      businessId: user.business.id,
    });
    const bookings = res.rental_bookings ?? [];
    const promo = (await this.rules.activeRules({ businessId: user.business.id, categoryId: null, country: null })).find(
      (r) => r.scope === 'promo'
    );
    return {
      promo: promo ? { rate_bps: promo.rate_bps, ends_at: promo.effective_to } : null,
      totals: this.totalsByCurrency(bookings.filter((b) => b.commission_status === 'earned')),
      bookings,
    };
  }

  totalsByCurrency(rows: Array<{ currency: string; commission_status: string; commission_base_amount?: any; commission_amount?: any; merchant_payout_amount?: any }>) {
    const sums = new Map<string, { base: bigint; commission: bigint; payout: bigint; count: number }>();
    for (const row of rows) {
      const entry = sums.get(row.currency) ?? { base: 0n, commission: 0n, payout: 0n, count: 0 };
      entry.base += toMinorUnits(row.commission_base_amount ?? 0, row.currency);
      entry.commission += toMinorUnits(row.commission_amount ?? 0, row.currency);
      entry.payout += toMinorUnits(row.merchant_payout_amount ?? 0, row.currency);
      entry.count += 1;
      sums.set(row.currency, entry);
    }
    return [...sums.entries()].map(([currency, s]) => ({
      currency,
      count: s.count,
      base_amount: fromMinorUnits(s.base, currency),
      commission_amount: fromMinorUnits(s.commission, currency),
      merchant_payout_amount: fromMinorUnits(s.payout, currency),
    }));
  }

  async report(filter: { from?: string; to?: string; businessId?: string; status?: string }) {
    const where: Record<string, unknown> = { commission_status: { _neq: 'not_applicable' } };
    if (filter.businessId) where.business_id = { _eq: filter.businessId };
    if (filter.status) where.commission_status = { _eq: filter.status };
    const range: Record<string, string> = {};
    if (filter.from) range._gte = filter.from;
    if (filter.to) range._lt = filter.to;
    if (Object.keys(range).length) where.created_at = range;
    const res = await this.hasura.executeQuery<{ rental_bookings: any[] }>(Q.COMMISSION_REPORT, { where });
    const rows = res.rental_bookings ?? [];
    return { totals: this.totalsByCurrency(rows.filter((r) => r.commission_status === 'earned')), bookings: rows };
  }
}
