import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { LaunchPromoService } from '../launch-promo/launch-promo.service';
import { GiveChangePayoutService } from '../mobile-payments/give-change-payout.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { WalletCreditCommissionType } from '../notifications/wallet-credit-push.messages';
import {
  PaymentRail,
  PaymentRoutingService,
} from '../stripe-payments/payment-routing.service';
import { StripePayoutService } from '../stripe-payments/stripe-payout.service';
import { Partners } from './generated-types';
import { CommissionBreakdown, CommissionConfig } from './types';
import { getCommissionForBusinessAccountType } from './business-account-type';

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    private readonly accountsService: AccountsService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly giveChangePayoutService: GiveChangePayoutService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly stripePayoutService: StripePayoutService,
    private readonly launchPromoService: LaunchPromoService
  ) {}

  /**
   * Calculate agent earnings for a specific order (synchronous version)
   * Takes order and config as input for better performance
   */
  calculateAgentEarningsSync(
    order: {
      id: string;
      base_delivery_fee: number;
      per_km_delivery_fee: number;
      currency: string;
      first_order_delivery_fee_promo?: boolean;
    },
    isAgentVerified: boolean,
    config: CommissionConfig
  ): {
    totalEarnings: number;
    baseDeliveryCommission: number;
    perKmDeliveryCommission: number;
    currency: string;
  } {
    try {
      // Calculate base delivery fee commission for agent
      const baseDeliveryCommission = this.calculateBaseDeliveryFeeCommissions(
        order.base_delivery_fee,
        isAgentVerified,
        config,
        [], // Empty partners array since we only want agent portion
        !!order.first_order_delivery_fee_promo
      ).agent;

      // Calculate per-km delivery fee commission for agent
      const perKmDeliveryCommission = this.calculatePerKmDeliveryFeeCommissions(
        order.per_km_delivery_fee,
        isAgentVerified,
        config,
        [] // Empty partners array since we only want agent portion
      ).agent;

      const totalEarnings = baseDeliveryCommission + perKmDeliveryCommission;

      return {
        totalEarnings,
        baseDeliveryCommission,
        perKmDeliveryCommission,
        currency: order.currency,
      };
    } catch (error: any) {
      this.logger.error(`Failed to calculate agent earnings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate agent earnings for a specific order
   */
  async calculateAgentEarnings(
    orderId: string,
    isAgentVerified: boolean
  ): Promise<{
    totalEarnings: number;
    baseDeliveryCommission: number;
    perKmDeliveryCommission: number;
    currency: string;
  }> {
    try {
      // Get order details
      const order = await this.getOrderById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Get commission configurations
      const config = await this.getCommissionConfigs();

      // Calculate base delivery fee commission for agent
      const baseDeliveryCommission = this.calculateBaseDeliveryFeeCommissions(
        order.base_delivery_fee,
        isAgentVerified,
        config,
        [], // Empty partners array since we only want agent portion
        !!order.first_order_delivery_fee_promo
      ).agent;

      // Calculate per-km delivery fee commission for agent
      const perKmDeliveryCommission = this.calculatePerKmDeliveryFeeCommissions(
        order.per_km_delivery_fee,
        isAgentVerified,
        config,
        [] // Empty partners array since we only want agent portion
      ).agent;

      const totalEarnings = baseDeliveryCommission + perKmDeliveryCommission;

      return {
        totalEarnings,
        baseDeliveryCommission,
        perKmDeliveryCommission,
        currency: order.currency,
      };
    } catch (error: any) {
      this.logger.error(`Failed to calculate agent earnings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  private async getOrderById(orderId: string): Promise<any> {
    const query = `
      query GetOrderById($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          base_delivery_fee
          per_km_delivery_fee
          delivery_fee_waived
          first_order_delivery_fee_promo
          currency
          subtotal
          assigned_agent {
            id
            is_verified
            user_id
          }
        }
      }
    `;

    const response = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });
    return response.orders_by_pk;
  }

  /**
   * Calculate commission breakdown for an order.
   * Uses business_location commission override when order has business_location_id.
   */
  async calculateCommissions(
    order: any,
    options?: { forceZeroItemCommission?: boolean }
  ): Promise<CommissionBreakdown> {
    try {
      const businessLocationId = order.business_location_id ?? order.business_location?.id ?? null;
      const config = await this.getCommissionConfigs(businessLocationId);
      if (options?.forceZeroItemCommission) {
        config.rendasuaItemCommissionPercentage = 0;
      }

      const partners = await this.getActivePartners();

      const baseDeliveryFeeBreakdown = this.withoutCollectedDeliveryRevenue(
        this.calculateBaseDeliveryFeeCommissions(
          order.base_delivery_fee,
          order.assigned_agent?.is_verified || false,
          config,
          partners,
          !!order.first_order_delivery_fee_promo
        ),
        !!order.delivery_fee_waived
      );

      const perKmDeliveryFeeBreakdown = this.withoutCollectedDeliveryRevenue(
        this.calculatePerKmDeliveryFeeCommissions(
          order.per_km_delivery_fee,
          order.assigned_agent?.is_verified || false,
          config,
          partners
        ),
        !!order.delivery_fee_waived
      );

      const itemCommissionBreakdown = this.calculateItemCommission(
        order.subtotal,
        config.rendasuaItemCommissionPercentage,
        partners
      );

      const orderSubtotalBreakdown = this.calculateOrderSubtotalBreakdown(
        order.subtotal,
        config.rendasuaItemCommissionPercentage
      );

      return {
        baseDeliveryFee: baseDeliveryFeeBreakdown,
        perKmDeliveryFee: perKmDeliveryFeeBreakdown,
        itemCommission: itemCommissionBreakdown,
        orderSubtotal: orderSubtotalBreakdown,
      };
    } catch (error: any) {
      this.logger.error(`Failed to calculate commissions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Distribute item-side commissions and business subtotal (on agent pickup).
   */
  async distributeItemCommissions(order: any): Promise<void> {
    const businessId = await this.resolveOrderBusinessId(order);
    const orderId = order?.id as string | undefined;
    const promoApplied =
      businessId && orderId
        ? await this.launchPromoService.consumePromoOrder(businessId, orderId)
        : false;
    if (promoApplied) {
      this.logger.log(
        `Launch promo 0% item commission applied for order ${order.order_number}`
      );
    }
    try {
      await this.settleItemCommissions(order, promoApplied);
    } catch (error: any) {
      if (promoApplied && businessId && orderId) {
        await this.launchPromoService.restorePromoOrder(businessId, orderId);
      }
      throw error;
    }
  }

  private async settleItemCommissions(
    order: any,
    forceZeroItemCommission: boolean
  ): Promise<void> {
    const breakdown = await this.calculateCommissions(order, {
      forceZeroItemCommission,
    });
    const rendasuaHQUser = await this.getRendasuaHQUser();
    if (!rendasuaHQUser) {
      throw new Error('RendaSua HQ user not found');
    }
    const partners = await this.getActivePartners();
    await this.processItemCommissions(
      order,
      breakdown.itemCommission,
      rendasuaHQUser,
      partners,
      forceZeroItemCommission
    );
    await this.processOrderSubtotalPayment(order, breakdown.orderSubtotal);
    await this.creditServiceFee(order, rendasuaHQUser);
  }

  /** Credit HQ the snapshotted service fee. Launch promo does not zero this. */
  private async creditServiceFee(
    order: { id: string; order_number: string; currency?: string; service_fee?: number },
    rendasuaHQUser: { id: string }
  ): Promise<void> {
    const amount = this.roundMoney(Number(order.service_fee) || 0);
    if (amount <= 0) return;
    await this.payCommission(
      order,
      rendasuaHQUser.id,
      'rendasua',
      'service_fee',
      amount,
      order.currency || 'XAF'
    );
  }

  /**
   * Distribute delivery fee commissions (on order completion).
   */
  async distributeDeliveryCommissions(order: any): Promise<void> {
    const breakdown = await this.calculateCommissions(order);
    const rendasuaHQUser = await this.getRendasuaHQUser();
    if (!rendasuaHQUser) {
      throw new Error('RendaSua HQ user not found');
    }
    if (order.delivery_fee_waived) {
      // Client pays nothing: the platform funds only the agent's pay. Partner shares
      // and the HQ revenue share are not paid (there is no collected fee to share).
      await this.settleWaivedDeliveryAgentPay(order, breakdown, rendasuaHQUser);
      return;
    }
    const partners = await this.getActivePartners();
    await this.processBaseDeliveryFeeCommissions(
      order,
      breakdown.baseDeliveryFee,
      rendasuaHQUser,
      partners
    );
    await this.processPerKmDeliveryFeeCommissions(
      order,
      breakdown.perKmDeliveryFee,
      rendasuaHQUser,
      partners
    );
  }

  /**
   * Waived delivery fee: Rendasua (HQ personal account) funds ONLY the agent's pay.
   *
   * Per component (base / per-km), in this order:
   *   1. HQ `payment` (allowNegative) of the agent share  -> audited as `platform_funded_delivery`
   *   2. agent `deposit` of the same amount (normal delivery commission memo)
   * If 2 fails the HQ debit is reversed (`deposit` back to HQ) and the error is thrown,
   * so nobody is paid from nothing. If 1 fails nobody is paid.
   * Retry safety (until ledger-level idempotency lands, issue #399): a component whose agent
   * credit already exists is skipped, and an un-reversed HQ funding row is not debited twice.
   */
  private async settleWaivedDeliveryAgentPay(
    order: any,
    breakdown: CommissionBreakdown,
    rendasuaHQUser: any
  ): Promise<void> {
    if (!order.assigned_agent?.user_id) return;
    const units: Array<{
      commissionType: 'base_delivery_fee' | 'per_km_delivery_fee';
      label: string;
      amount: number;
    }> = [
      {
        commissionType: 'base_delivery_fee',
        label: 'base',
        amount: this.roundMoney(breakdown.baseDeliveryFee.agent),
      },
      {
        commissionType: 'per_km_delivery_fee',
        label: 'per km',
        amount: this.roundMoney(breakdown.perKmDeliveryFee.agent),
      },
    ];
    for (const unit of units) {
      if (unit.amount <= 0) continue;
      await this.fundAndPayWaivedAgentUnit(order, rendasuaHQUser, unit);
    }
  }

  private async fundAndPayWaivedAgentUnit(
    order: any,
    rendasuaHQUser: any,
    unit: {
      commissionType: 'base_delivery_fee' | 'per_km_delivery_fee';
      label: string;
      amount: number;
    }
  ): Promise<void> {
    const currency = order.currency;
    const agentUserId = order.assigned_agent.user_id;
    const agentAccount = await this.hasuraSystemService.getAccount(
      agentUserId,
      currency
    );
    const hqAccount = await this.hasuraSystemService.getAccount(
      rendasuaHQUser.id,
      currency
    );
    if (!agentAccount?.id || !hqAccount?.id) {
      throw new Error(
        `Waived delivery funding for order ${order.order_number}: agent or HQ account not found`
      );
    }

    const creditMemo = this.commissionDepositMemo(
      order.order_number,
      'agent',
      unit.commissionType
    );
    if (await this.hasAgentCredit(agentAccount.id, order.id, creditMemo)) {
      this.logger.warn(
        `Waived delivery agent pay already credited, skipping: order=${order.order_number} type=${unit.commissionType}`
      );
      return;
    }

    const fundingMemo = `Waived delivery fee funded by platform (agent ${unit.label} pay) - order ${order.order_number}`;
    const reversalMemo = `${fundingMemo} - reversal`;
    let fundingTransactionId: string | undefined;
    if (!(await this.hasOpenWaivedFunding(hqAccount.id, order.id, fundingMemo, reversalMemo))) {
      const debit = await this.accountsService.registerTransaction({
        accountId: hqAccount.id,
        amount: unit.amount,
        transactionType: 'payment',
        memo: fundingMemo,
        referenceId: order.id,
        allowNegative: true,
      });
      if (!debit?.success || !debit.transactionId) {
        throw new Error(
          `Waived delivery funding failed for order ${order.order_number} (${unit.commissionType}): ${debit?.error ?? 'unknown error'}`
        );
      }
      fundingTransactionId = debit.transactionId;
      await this.auditPlatformFunding(order, rendasuaHQUser.id, unit.amount, debit.transactionId);
    }

    const credit = await this.accountsService.registerTransaction({
      accountId: agentAccount.id,
      amount: unit.amount,
      transactionType: 'deposit',
      memo: creditMemo,
      referenceId: order.id,
      idempotencyKey: this.commissionIdempotencyKey(
        order.id,
        agentAccount.id,
        'agent',
        unit.commissionType
      ),
    });
    if (credit?.success && credit.alreadyExists) {
      // A concurrent run credited the agent first: undo any funding this run just made.
      if (fundingTransactionId) {
        await this.reverseWaivedFunding(order, hqAccount.id, unit.amount, reversalMemo);
      }
      this.logger.warn(
        `Waived delivery agent pay already credited (idempotency key), skipping: order=${order.order_number} type=${unit.commissionType}`
      );
      return;
    }
    if (!credit?.success || !credit.transactionId) {
      await this.reverseWaivedFunding(order, hqAccount.id, unit.amount, reversalMemo);
      throw new Error(
        `Waived delivery agent credit failed for order ${order.order_number} (${unit.commissionType}); platform funding reversed: ${credit?.error ?? 'unknown error'}`
      );
    }

    try {
      await this.auditCommissionPayout({
        orderId: order.id,
        recipientUserId: agentUserId,
        recipientType: 'agent',
        commissionType: unit.commissionType,
        amount: unit.amount,
        currency,
        accountTransactionId: credit.transactionId,
      });
    } catch (error: any) {
      this.logger.error(
        `Waived delivery agent payout audit failed (non-fatal) order=${order.order_number}: ${error?.message}`
      );
    }
    this.logger.log(
      `Platform funded ${unit.amount} ${currency} waived delivery ${unit.label} pay to agent for order ${order.order_number}` +
        (fundingTransactionId ? '' : ' (funding already recorded)')
    );
    void this.notificationsService.sendWalletCreditPush({
      userId: agentUserId,
      amount: unit.amount,
      currency,
      commissionType: unit.commissionType as WalletCreditCommissionType,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.assigned_agent?.user?.preferred_language,
    });
    try {
      await this.tryAutoWithdrawAfterCommission({
        order,
        recipientUserId: agentUserId,
        recipientType: 'agent',
        accountId: agentAccount.id,
        amount: unit.amount,
        currency,
      });
    } catch (error: any) {
      this.logger.warn(
        `Auto-withdraw after commission failed (non-fatal): ${error.message}`
      );
    }
  }

  private async reverseWaivedFunding(
    order: any,
    hqAccountId: string,
    amount: number,
    reversalMemo: string
  ): Promise<void> {
    const reversal = await this.accountsService.registerTransaction({
      accountId: hqAccountId,
      amount,
      transactionType: 'deposit',
      memo: reversalMemo,
      referenceId: order.id,
      skipCashAdvanceRepayment: true,
    });
    if (!reversal?.success) {
      this.logger.error(
        `waived_delivery_funding_reversal_failed order=${order.order_number} orderId=${order.id} amount=${amount}: ${reversal?.error ?? 'unknown'} - HQ account is short, manual fix required`
      );
    }
  }

  /** HQ funding row exists for this unit and has not been reversed. */
  private async hasOpenWaivedFunding(
    hqAccountId: string,
    orderId: string,
    fundingMemo: string,
    reversalMemo: string
  ): Promise<boolean> {
    const result = await this.hasuraSystemService.executeQuery(
      `query WaivedFundingRows($accountId: uuid!, $orderId: uuid!, $memos: [String!]!) {
        account_transactions(
          where: {
            account_id: { _eq: $accountId }
            reference_id: { _eq: $orderId }
            memo: { _in: $memos }
          }
        ) { memo }
      }`,
      { accountId: hqAccountId, orderId, memos: [fundingMemo, reversalMemo] }
    );
    const rows: Array<{ memo: string }> = result?.account_transactions ?? [];
    const funded = rows.filter((r) => r.memo === fundingMemo).length;
    const reversed = rows.filter((r) => r.memo === reversalMemo).length;
    return funded > reversed;
  }

  /** Agent already received this component (a deposit, or the cash-advance repayment it became). */
  private async hasAgentCredit(
    accountId: string,
    orderId: string,
    memo: string
  ): Promise<boolean> {
    const result = await this.hasuraSystemService.executeQuery(
      `query WaivedAgentCreditExists($accountId: uuid!, $orderId: uuid!, $memos: [String!]!) {
        account_transactions(
          where: {
            account_id: { _eq: $accountId }
            reference_id: { _eq: $orderId }
            memo: { _in: $memos }
          }
          limit: 1
        ) { id }
      }`,
      {
        accountId,
        orderId,
        memos: [memo, `Cash advance repayment - ${memo}`],
      }
    );
    return (result?.account_transactions?.length ?? 0) > 0;
  }

  /** Audit row for the platform subsidy; never breaks settlement (money already moved). */
  private async auditPlatformFunding(
    order: any,
    hqUserId: string,
    amount: number,
    accountTransactionId: string
  ): Promise<void> {
    try {
      await this.auditCommissionPayout({
        orderId: order.id,
        recipientUserId: hqUserId,
        recipientType: 'rendasua',
        commissionType: 'platform_funded_delivery',
        amount,
        currency: order.currency,
        accountTransactionId,
      });
    } catch (error: any) {
      this.logger.error(
        `platform_funded_delivery audit failed order=${order.order_number} orderId=${order.id} amount=${amount}: ${error?.message}`
      );
    }
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  /**
   * Distribute all commissions (item + delivery); use split methods for phased settlement.
   */
  async distributeCommissions(order: any): Promise<void> {
    try {
      this.logger.log(
        `Starting commission distribution for order ${order.order_number}`
      );
      await this.distributeItemCommissions(order);
      await this.distributeDeliveryCommissions(order);
      this.logger.log(
        `Successfully distributed commissions for order ${order.order_number}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to distribute commissions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active partners
   */
  async getActivePartners(): Promise<Partners[]> {
    const query = `
      query GetActivePartners {
        partners(where: { is_active: { _eq: true } }) {
          id
          user_id
          company_name
          base_delivery_fee_commission
          per_km_delivery_fee_commission
          item_commission
          is_active
          created_at
          updated_at
        }
      }
    `;

    const response = await this.hasuraSystemService.executeQuery(query);
    return response.partners || [];
  }

  /**
   * Get RendaSua HQ user
   */
  async getRendasuaHQUser(): Promise<any> {
    const query = `
      query GetRendasuaHQUser {
        users(where: { email: { _eq: "hq@rendasua.com" } }) {
          id
          first_name
          last_name
          email
          phone_number
        }
      }
    `;

    const response = await this.hasuraSystemService.executeQuery(query);
    return response.users?.[0] || null;
  }

  /**
   * Get commission configurations.
   * Item commission is derived from businesses.account_type via the centralized helper.
   * Delivery-fee commissions continue to come from application_configurations.
   */
  async getCommissionConfigs(businessLocationId?: string | null): Promise<CommissionConfig> {
    const deliveryQuery = `
      query GetDeliveryCommissionConfigs {
        application_configurations(
          where: {
            config_key: { _in: [
              "unverified_agent_base_delivery_commission",
              "verified_agent_base_delivery_commission",
              "unverified_agent_per_km_delivery_commission",
              "verified_agent_per_km_delivery_commission"
            ]}
          }
        ) {
          config_key
          number_value
        }
      }
    `;

    const response = await this.hasuraSystemService.executeQuery(deliveryQuery);
    const configs = response.application_configurations || [];

    const configMap = configs.reduce((acc: any, config: any) => {
      acc[config.config_key] = config.number_value;
      return acc;
    }, {});

    // Resolve item commission from business account type + business primary country
    // (same source as GET /business-items/business/account-type) so UI rates and
    // order commissions stay aligned for multi-location merchants.
    let rendasuaItemCommissionPercentage = getCommissionForBusinessAccountType();

    if (businessLocationId) {
      const locQuery = `
        query GetBusinessLocationAccountType($id: uuid!) {
          business_locations_by_pk(id: $id) {
            business {
              id
              account_type
              business_locations(
                where: { is_active: { _eq: true } }
                order_by: { is_primary: desc }
              ) {
                address { country }
              }
              business_addresses {
                address { country }
              }
            }
          }
        }
      `;
      const locResponse = await this.hasuraSystemService.executeQuery(locQuery, {
        id: businessLocationId,
      });
      const business = locResponse.business_locations_by_pk?.business;
      const accountType = business?.account_type;
      let countryCode: string | null = null;
      for (const loc of business?.business_locations ?? []) {
        if (loc?.address?.country) {
          countryCode = loc.address.country;
          break;
        }
      }
      if (!countryCode) {
        for (const row of business?.business_addresses ?? []) {
          if (row?.address?.country) {
            countryCode = row.address.country;
            break;
          }
        }
      }
      rendasuaItemCommissionPercentage = getCommissionForBusinessAccountType(
        accountType,
        countryCode
      );
    }

    return {
      rendasuaItemCommissionPercentage,
      unverifiedAgentBaseDeliveryCommission:
        configMap.unverified_agent_base_delivery_commission || 80.0,
      verifiedAgentBaseDeliveryCommission:
        configMap.verified_agent_base_delivery_commission || 80.0,
      unverifiedAgentPerKmDeliveryCommission:
        configMap.unverified_agent_per_km_delivery_commission || 80.0,
      verifiedAgentPerKmDeliveryCommission:
        configMap.verified_agent_per_km_delivery_commission || 80.0,
    };
  }

  /** Agent and partner shares stay; uncollected delivery fee is not platform revenue. */
  private withoutCollectedDeliveryRevenue(
    breakdown: { agent: number; partner: number; rendasua: number },
    deliveryFeeWaived: boolean
  ): { agent: number; partner: number; rendasua: number } {
    if (!deliveryFeeWaived) return breakdown;
    return { ...breakdown, rendasua: 0 };
  }

  /**
   * Calculate base delivery fee commission breakdown
   */
  private calculateBaseDeliveryFeeCommissions(
    baseDeliveryFee: number,
    isAgentVerified: boolean,
    config: CommissionConfig,
    partners: Partners[],
    firstOrderDeliveryFeePromo = false
  ): { agent: number; partner: number; rendasua: number } {
    if (firstOrderDeliveryFeePromo) {
      let partnerAmount = 0;
      partners.forEach((partner) => {
        partnerAmount +=
          (baseDeliveryFee * partner.base_delivery_fee_commission) / 100;
      });
      const agentAmount = Math.max(0, baseDeliveryFee - partnerAmount);
      return {
        agent: agentAmount,
        partner: partnerAmount,
        rendasua: 0,
      };
    }

    const agentCommission = isAgentVerified
      ? config.verifiedAgentBaseDeliveryCommission
      : config.unverifiedAgentBaseDeliveryCommission;

    const agentAmount = (baseDeliveryFee * agentCommission) / 100;

    let partnerAmount = 0;
    partners.forEach((partner) => {
      partnerAmount +=
        (baseDeliveryFee * partner.base_delivery_fee_commission) / 100;
    });

    const rendasuaAmount = baseDeliveryFee - agentAmount - partnerAmount;

    return {
      agent: agentAmount,
      partner: partnerAmount,
      rendasua: rendasuaAmount,
    };
  }

  /**
   * Calculate per-km delivery fee commission breakdown
   */
  private calculatePerKmDeliveryFeeCommissions(
    perKmDeliveryFee: number,
    isAgentVerified: boolean,
    config: CommissionConfig,
    partners: Partners[]
  ): { agent: number; partner: number; rendasua: number } {
    const agentCommission = isAgentVerified
      ? config.verifiedAgentPerKmDeliveryCommission
      : config.unverifiedAgentPerKmDeliveryCommission;

    const agentAmount = (perKmDeliveryFee * agentCommission) / 100;

    // Calculate partner commissions
    let partnerAmount = 0;
    partners.forEach((partner) => {
      partnerAmount +=
        (perKmDeliveryFee * partner.per_km_delivery_fee_commission) / 100;
    });

    const rendasuaAmount = perKmDeliveryFee - agentAmount - partnerAmount;

    return {
      agent: agentAmount,
      partner: partnerAmount,
      rendasua: rendasuaAmount,
    };
  }

  /**
   * Calculate item commission breakdown (on RendaSua's portion)
   */
  private calculateItemCommission(
    subtotal: number,
    rendasuaItemCommissionPercentage: number,
    partners: Partners[]
  ): { partner: number; rendasua: number } {
    const rendasuaItemAmount =
      (subtotal * rendasuaItemCommissionPercentage) / 100;

    // Calculate partner commissions on RendaSua's portion
    let partnerAmount = 0;
    partners.forEach((partner) => {
      partnerAmount += (rendasuaItemAmount * partner.item_commission) / 100;
    });

    const rendasuaAmount = rendasuaItemAmount - partnerAmount;

    return {
      partner: partnerAmount,
      rendasua: rendasuaAmount,
    };
  }

  /**
   * Calculate order subtotal breakdown
   */
  private calculateOrderSubtotalBreakdown(
    subtotal: number,
    rendasuaItemCommissionPercentage: number
  ): { business: number; rendasua: number } {
    const rendasuaAmount = (subtotal * rendasuaItemCommissionPercentage) / 100;
    const businessAmount = subtotal - rendasuaAmount;

    return {
      business: businessAmount,
      rendasua: rendasuaAmount,
    };
  }

  /**
   * Process base delivery fee commissions
   */
  private async processBaseDeliveryFeeCommissions(
    order: any,
    breakdown: { agent: number; partner: number; rendasua: number },
    rendasuaHQUser: any,
    partners: Partners[]
  ): Promise<void> {
    // Pay agent
    if (order.assigned_agent && breakdown.agent > 0) {
      await this.payCommission(
        order,
        order.assigned_agent.user_id,
        'agent',
        'base_delivery_fee',
        breakdown.agent,
        order.currency
      );
    }

    // Pay partners
    for (const partner of partners) {
      const partnerAmount =
        (order.base_delivery_fee * partner.base_delivery_fee_commission) / 100;
      if (partnerAmount > 0) {
        await this.payCommission(
          order,
          partner.user_id,
          'partner',
          'base_delivery_fee',
          partnerAmount,
          order.currency,
          partner.base_delivery_fee_commission
        );
      }
    }

    // Pay RendaSua HQ
    if (breakdown.rendasua > 0) {
      await this.payCommission(
        order,
        rendasuaHQUser.id,
        'rendasua',
        'base_delivery_fee',
        breakdown.rendasua,
        order.currency
      );
    }
  }

  /**
   * Process per-km delivery fee commissions
   */
  private async processPerKmDeliveryFeeCommissions(
    order: any,
    breakdown: { agent: number; partner: number; rendasua: number },
    rendasuaHQUser: any,
    partners: Partners[]
  ): Promise<void> {
    // Pay agent
    if (order.assigned_agent && breakdown.agent > 0) {
      await this.payCommission(
        order,
        order.assigned_agent.user_id,
        'agent',
        'per_km_delivery_fee',
        breakdown.agent,
        order.currency
      );
    }

    // Pay partners
    for (const partner of partners) {
      const partnerAmount =
        (order.per_km_delivery_fee * partner.per_km_delivery_fee_commission) /
        100;
      if (partnerAmount > 0) {
        await this.payCommission(
          order,
          partner.user_id,
          'partner',
          'per_km_delivery_fee',
          partnerAmount,
          order.currency,
          partner.per_km_delivery_fee_commission
        );
      }
    }

    // Pay RendaSua HQ
    if (breakdown.rendasua > 0) {
      await this.payCommission(
        order,
        rendasuaHQUser.id,
        'rendasua',
        'per_km_delivery_fee',
        breakdown.rendasua,
        order.currency
      );
    }
  }

  /**
   * Process item commissions (uses location commission % from breakdown calculation).
   */
  private async processItemCommissions(
    order: any,
    breakdown: { partner: number; rendasua: number },
    rendasuaHQUser: any,
    partners: Partners[],
    forceZeroItemCommission = false
  ): Promise<void> {
    if (forceZeroItemCommission) {
      return;
    }
    const businessLocationId =
      order.business_location_id ?? order.business_location?.id ?? null;
    const config = await this.getCommissionConfigs(businessLocationId);
    const rendasuaItemAmount =
      (order.subtotal * config.rendasuaItemCommissionPercentage) / 100;

    for (const partner of partners) {
      const partnerAmount = (rendasuaItemAmount * partner.item_commission) / 100;
      if (partnerAmount > 0) {
        await this.payCommission(
          order,
          partner.user_id,
          'partner',
          'item_sale',
          partnerAmount,
          order.currency,
          partner.item_commission
        );
      }
    }

    if (breakdown.rendasua > 0) {
      await this.payCommission(
        order,
        rendasuaHQUser.id,
        'rendasua',
        'item_sale',
        breakdown.rendasua,
        order.currency
      );
    }
  }

  /**
   * Process order subtotal payment to the business_location account (not legacy business user account).
   */
  private async processOrderSubtotalPayment(
    order: any,
    breakdown: { business: number; rendasua: number }
  ): Promise<void> {
    if (breakdown.business <= 0) return;
    const businessLocationId = order.business_location_id ?? order.business_location?.id ?? null;
    const userId = order.business?.user_id;
    if (!userId) return;
    await this.payCommission(
      order,
      userId,
      'business',
      'order_subtotal',
      breakdown.business,
      order.currency,
      undefined,
      businessLocationId
    );
  }

  /**
   * Pay commission to a recipient.
   * When recipientType is 'business' and businessLocationId is set, credits the location-scoped account.
   */
  private async payCommission(
    order: any,
    recipientUserId: string,
    recipientType: 'partner' | 'rendasua' | 'agent' | 'business',
    commissionType:
      | 'base_delivery_fee'
      | 'per_km_delivery_fee'
      | 'item_sale'
      | 'order_subtotal'
      | 'service_fee',
    amount: number,
    currency: string,
    commissionPercentage?: number,
    businessLocationId?: string | null
  ): Promise<void> {
    try {
      const account = await this.hasuraSystemService.getAccount(
        recipientUserId,
        currency,
        businessLocationId ?? undefined
      );
      if (!account) {
        throw new Error(
          `Account not found for user ${recipientUserId} with currency ${currency}`
        );
      }

      const memo = this.commissionDepositMemo(
        order.order_number,
        recipientType,
        commissionType
      );

      // A retried settlement must not pay the same recipient twice: the ledger
      // row (account + deposit + order + deterministic memo) is the source of truth.
      if (await this.hasCommissionDeposit(account.id, order.id, memo)) {
        this.logger.warn(
          `Commission already deposited, skipping: order=${order.order_number} recipient=${recipientType} type=${commissionType}`
        );
        return;
      }

      // Create account transaction
      const transaction = await this.accountsService.registerTransaction({
        accountId: account.id,
        amount: amount,
        transactionType: 'deposit',
        memo,
        referenceId: order.id,
        // DB-enforced once-only (account_transactions_idempotency_key_key): the read
        // above is only a fast path, this closes the read-then-insert race.
        idempotencyKey: this.commissionIdempotencyKey(
          order.id,
          account.id,
          recipientType,
          commissionType
        ),
      });

      if (transaction?.success && transaction.alreadyExists) {
        this.logger.warn(
          `Commission already deposited (idempotency key), skipping: order=${order.order_number} recipient=${recipientType} type=${commissionType}`
        );
        return;
      }

      if (!transaction?.success || !transaction.transactionId) {
        throw new Error(
          `Commission deposit failed for ${recipientType}/${commissionType} on order ${order.order_number}: ${transaction?.error ?? 'unknown error'}`
        );
      }

      // Record commission payout audit
      if (transaction.transactionId) {
        await this.auditCommissionPayout({
          orderId: order.id,
          recipientUserId,
          recipientType,
          commissionType,
          amount,
          currency,
          commissionPercentage,
          accountTransactionId: transaction.transactionId,
        });
      }

      this.logger.log(
        `Paid ${amount} ${currency} commission to ${recipientType} for order ${order.order_number}`
      );

      if (
        transaction.success &&
        transaction.transactionId &&
        (recipientType === 'agent' || recipientType === 'business')
      ) {
        void this.notificationsService.sendWalletCreditPush({
          userId: recipientUserId,
          amount,
          currency,
          commissionType: commissionType as WalletCreditCommissionType,
          orderId: order.id,
          orderNumber: order.order_number,
          preferredLanguage: this.preferredLanguageForCommissionRecipient(
            order,
            recipientType,
            recipientUserId
          ),
        });
      }

      if (transaction.success && transaction.transactionId) {
        try {
          await this.tryAutoWithdrawAfterCommission({
            order,
            recipientUserId,
            recipientType,
            accountId: account.id,
            amount,
            currency,
            businessLocationId,
          });
        } catch (error: any) {
          this.logger.warn(
            `Auto-withdraw after commission failed (non-fatal): ${error.message}`
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to pay commission to ${recipientType}: ${error.message}`
      );
      throw error;
    }
  }

  private commissionIdempotencyKey(
    orderId: string,
    accountId: string,
    recipientType: string,
    commissionType: string
  ): string {
    return `commission:${orderId}:${accountId}:${recipientType}:${commissionType}`;
  }

  /** True when this account already received this order's commission deposit (same memo). */
  private async hasCommissionDeposit(
    accountId: string,
    orderId: string,
    memo: string
  ): Promise<boolean> {
    const result = await this.hasuraSystemService.executeQuery(
      `query CommissionDepositExists(
        $accountId: uuid!
        $orderId: uuid!
        $memo: String!
      ) {
        account_transactions(
          where: {
            account_id: { _eq: $accountId }
            transaction_type: { _eq: deposit }
            reference_id: { _eq: $orderId }
            memo: { _eq: $memo }
          }
          limit: 1
        ) { id }
      }`,
      { accountId, orderId, memo }
    );
    return (result?.account_transactions?.length ?? 0) > 0;
  }

  /** Human-readable wallet memo — merchant cut is settlement, not “commission”. */
  private commissionDepositMemo(
    orderNumber: string,
    recipientType: 'partner' | 'rendasua' | 'agent' | 'business',
    commissionType:
      | 'base_delivery_fee'
      | 'per_km_delivery_fee'
      | 'item_sale'
      | 'order_subtotal'
      | 'service_fee'
  ): string {
    const labels: Record<string, string> = {
      'business:order_subtotal': `Merchant earnings for order ${orderNumber} (after platform commission)`,
      'rendasua:item_sale': `Platform commission for order ${orderNumber}`,
      'rendasua:service_fee': `Service fee for order ${orderNumber}`,
      'partner:item_sale': `Partner share of platform commission for order ${orderNumber}`,
      'base_delivery_fee': `Delivery commission (base) for order ${orderNumber} (${recipientType})`,
      'per_km_delivery_fee': `Delivery commission (per km) for order ${orderNumber} (${recipientType})`,
    };
    return (
      labels[`${recipientType}:${commissionType}`] ??
      labels[commissionType] ??
      `Commission payment for order ${orderNumber} (${commissionType})`
    );
  }

  private preferredLanguageForCommissionRecipient(
    order: any,
    recipientType: 'agent' | 'business',
    recipientUserId: string
  ): string | undefined {
    if (recipientType === 'business') {
      return (
        order.business?.user?.preferred_language ??
        order.business_location?.business?.user?.preferred_language
      );
    }
    if (
      recipientType === 'agent' &&
      order.assigned_agent?.user_id === recipientUserId
    ) {
      return order.assigned_agent?.user?.preferred_language;
    }
    return undefined;
  }

  private async tryAutoWithdrawAfterCommission(ctx: {
    order: any;
    recipientUserId: string;
    recipientType: 'partner' | 'rendasua' | 'agent' | 'business';
    accountId: string;
    amount: number;
    currency: string;
    businessLocationId?: string | null;
  }): Promise<void> {
    if (ctx.amount <= 0) return;

    const eligibility = await this.resolveAutoWithdrawEligibility(ctx);
    if (!eligibility) return;

    if (eligibility.rail === 'stripe') {
      await this.payoutStripeCommission(ctx);
      return;
    }

    if (!eligibility.phone) return;
    await this.giveChangePayoutService.executeGiveChangePayout(
      {
        amount: ctx.amount,
        currency: ctx.currency,
        description: `Comm order ${ctx.order.order_number}`,
        customerPhone: eligibility.phone,
        accountId: ctx.accountId,
        mtnUserId: ctx.recipientUserId,
        withdrawalMemoPrefix: 'Auto payout',
      },
      { throwOnWithdrawalFailure: false }
    );
  }

  private async payoutStripeCommission(ctx: {
    order: any;
    recipientUserId: string;
    recipientType: string;
    accountId: string;
    amount: number;
    currency: string;
  }): Promise<void> {
    const result = await this.stripePayoutService.executePayout(
      {
        amount: ctx.amount,
        currency: ctx.currency,
        accountId: ctx.accountId,
        userId: ctx.recipientUserId,
        description: `Comm order ${ctx.order.order_number}`,
        withdrawalMemoPrefix: 'Auto payout',
      },
      { throwOnFailure: false }
    );
    if (result.success) return;
    this.logger.error(
      `stripe_auto_payout_failed order=${ctx.order.order_number} recipient=${ctx.recipientType} user=${ctx.recipientUserId} amount=${ctx.amount} ${ctx.currency} error=${result.error ?? 'unknown'}`
    );
  }

  private async resolveAutoWithdrawEligibility(ctx: {
    recipientUserId: string;
    recipientType: 'partner' | 'rendasua' | 'agent' | 'business';
    businessLocationId?: string | null;
  }): Promise<{ phone: string; rail: PaymentRail } | null> {
    let phone: string | null = null;

    if (ctx.recipientType === 'business' && ctx.businessLocationId) {
      const loc = await this.getLocationAutoWithdraw(ctx.businessLocationId);
      if (!loc || loc.auto_withdraw_commissions === false) return null;
      phone = (loc.phone ?? '').trim();
    } else if (ctx.recipientType === 'agent') {
      const ag = await this.getAgentAutoWithdraw(ctx.recipientUserId);
      if (!ag || ag.auto_withdraw_commissions !== true) return null;
      phone = (ag.phone ?? '').trim();
    } else {
      return null;
    }

    const rail = await this.paymentRoutingService.resolveRailForUser(
      ctx.recipientUserId
    );
    // Stripe-enabled countries pay out to the connected account, so no phone is
    // required. Mobile-money rails still need a valid phone for the payout.
    if (rail !== 'stripe' && !phone) return null;

    return { phone, rail };
  }

  private async getLocationAutoWithdraw(
    locationId: string
  ): Promise<{ auto_withdraw_commissions: boolean; phone?: string | null } | null> {
    const query = `
      query LocAutoWithdraw($id: uuid!) {
        business_locations_by_pk(id: $id) {
          auto_withdraw_commissions
          phone
          mobile_payment_phone { phone_e164 is_verified }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      id: locationId,
    });
    const row = res.business_locations_by_pk;
    if (!row) return null;
    const registryPhone =
      row.mobile_payment_phone?.is_verified === true
        ? row.mobile_payment_phone.phone_e164
        : null;
    return {
      auto_withdraw_commissions: row.auto_withdraw_commissions,
      phone: registryPhone ?? row.phone,
    };
  }

  private async getAgentAutoWithdraw(
    userId: string
  ): Promise<{ auto_withdraw_commissions: boolean; phone?: string | null } | null> {
    const query = `
      query AgentAutoWithdraw($uid: uuid!) {
        agents(where: { user_id: { _eq: $uid } }, limit: 1) {
          auto_withdraw_commissions
          mobile_payment_phone { phone_e164 is_verified }
          user { phone_number }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      uid: userId,
    });
    const row = res.agents?.[0];
    if (!row) return null;
    const registryPhone =
      row.mobile_payment_phone?.is_verified === true
        ? row.mobile_payment_phone.phone_e164
        : null;
    return {
      auto_withdraw_commissions: Boolean(row.auto_withdraw_commissions),
      phone: registryPhone ?? row.user?.phone_number,
    };
  }

  private async resolveOrderBusinessId(order: any): Promise<string | null> {
    if (order?.business_id) return String(order.business_id);
    const locationId =
      order?.business_location_id ?? order?.business_location?.id ?? null;
    if (!locationId) return null;
    try {
      const result = await this.hasuraSystemService.executeQuery(
        `query OrderBusinessId($id: uuid!) {
          business_locations_by_pk(id: $id) { business_id }
        }`,
        { id: locationId }
      );
      return result?.business_locations_by_pk?.business_id ?? null;
    } catch (error: any) {
      this.logger.warn(
        `Failed to resolve business for location ${locationId}: ${error?.message}`
      );
      return null;
    }
  }

  /**
   * Record commission payout in audit table
   */
  private async auditCommissionPayout(payout: {
    orderId: string;
    recipientUserId: string;
    recipientType: string;
    commissionType: string;
    amount: number;
    currency: string;
    commissionPercentage?: number;
    accountTransactionId: string;
  }): Promise<void> {
    const mutation = `
      mutation InsertCommissionPayout($payout: commission_payouts_insert_input!) {
        insert_commission_payouts_one(object: $payout) {
          id
        }
      }
    `;

    const variables = {
      payout: {
        order_id: payout.orderId,
        recipient_user_id: payout.recipientUserId,
        recipient_type: payout.recipientType,
        commission_type: payout.commissionType,
        amount: payout.amount,
        currency: payout.currency,
        commission_percentage: payout.commissionPercentage,
        account_transaction_id: payout.accountTransactionId,
      },
    };

    await this.hasuraSystemService.executeMutation(mutation, variables);
  }
}
