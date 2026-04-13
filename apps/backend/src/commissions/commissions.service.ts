import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { GiveChangePayoutService } from '../mobile-payments/give-change-payout.service';
import { Partners } from './generated-types';
import { CommissionBreakdown, CommissionConfig } from './types';

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    private readonly accountsService: AccountsService,
    private readonly hasuraSystemService: HasuraSystemService,
    @Inject(forwardRef(() => GiveChangePayoutService))
    private readonly giveChangePayoutService: GiveChangePayoutService
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
  async calculateCommissions(order: any): Promise<CommissionBreakdown> {
    try {
      const businessLocationId = order.business_location_id ?? order.business_location?.id ?? null;
      const config = await this.getCommissionConfigs(businessLocationId);

      const partners = await this.getActivePartners();

      const baseDeliveryFeeBreakdown = this.calculateBaseDeliveryFeeCommissions(
        order.base_delivery_fee,
        order.assigned_agent?.is_verified || false,
        config,
        partners,
        !!order.first_order_delivery_fee_promo
      );

      const perKmDeliveryFeeBreakdown =
        this.calculatePerKmDeliveryFeeCommissions(
          order.per_km_delivery_fee,
          order.assigned_agent?.is_verified || false,
          config,
          partners
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
    const breakdown = await this.calculateCommissions(order);
    const rendasuaHQUser = await this.getRendasuaHQUser();
    if (!rendasuaHQUser) {
      throw new Error('RendaSua HQ user not found');
    }
    const partners = await this.getActivePartners();
    await this.processItemCommissions(
      order,
      breakdown.itemCommission,
      rendasuaHQUser,
      partners
    );
    await this.processOrderSubtotalPayment(order, breakdown.orderSubtotal);
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
   * When businessLocationId is provided, uses business_locations.rendasua_item_commission_percentage if set; else application default.
   */
  async getCommissionConfigs(businessLocationId?: string | null): Promise<CommissionConfig> {
    const query = `
      query GetCommissionConfigs {
        application_configurations(
          where: { 
            config_key: { _in: [
              "rendasua_item_commission_percentage",
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

    const response = await this.hasuraSystemService.executeQuery(query);
    const configs = response.application_configurations || [];

    const configMap = configs.reduce((acc: any, config: any) => {
      acc[config.config_key] = config.number_value;
      return acc;
    }, {});

    let rendasuaItemCommissionPercentage =
      configMap.rendasua_item_commission_percentage || 5.0;

    if (businessLocationId) {
      const locQuery = `
        query GetBusinessLocationCommission($id: uuid!) {
          business_locations_by_pk(id: $id) {
            rendasua_item_commission_percentage
          }
        }
      `;
      const locResponse = await this.hasuraSystemService.executeQuery(locQuery, {
        id: businessLocationId,
      });
      const pct = locResponse.business_locations_by_pk?.rendasua_item_commission_percentage;
      if (pct != null && typeof pct === 'number') {
        rendasuaItemCommissionPercentage = pct;
      }
    }

    return {
      rendasuaItemCommissionPercentage,
      unverifiedAgentBaseDeliveryCommission:
        configMap.unverified_agent_base_delivery_commission || 50.0,
      verifiedAgentBaseDeliveryCommission:
        configMap.verified_agent_base_delivery_commission || 0.0,
      unverifiedAgentPerKmDeliveryCommission:
        configMap.unverified_agent_per_km_delivery_commission || 80.0,
      verifiedAgentPerKmDeliveryCommission:
        configMap.verified_agent_per_km_delivery_commission || 20.0,
    };
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
    partners: Partners[]
  ): Promise<void> {
    const businessLocationId = order.business_location_id ?? order.business_location?.id ?? null;
    const config = await this.getCommissionConfigs(businessLocationId);
    const rendasuaItemAmount = (order.subtotal * config.rendasuaItemCommissionPercentage) / 100;

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
      | 'order_subtotal',
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
        this.logger.warn(
          `Account not found for user ${recipientUserId} with currency ${currency}`
        );
        return;
      }

      // Create account transaction
      const transaction = await this.accountsService.registerTransaction({
        accountId: account.id,
        amount: amount,
        transactionType: 'deposit',
        memo: `Commission payment for order ${order.order_number} (${commissionType})`,
        referenceId: order.id,
      });

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

    let phone: string;
    let mtnUserId: string;

    if (ctx.recipientType === 'business' && ctx.businessLocationId) {
      const loc = await this.getLocationAutoWithdraw(ctx.businessLocationId);
      if (!loc || loc.auto_withdraw_commissions === false) return;
      phone = (loc.phone ?? '').trim();
      if (!phone) return;
      mtnUserId = ctx.recipientUserId;
    } else if (ctx.recipientType === 'agent') {
      const ag = await this.getAgentAutoWithdraw(ctx.recipientUserId);
      if (!ag || ag.auto_withdraw_commissions !== true) return;
      phone = (ag.phone ?? '').trim();
      if (!phone) return;
      mtnUserId = ctx.recipientUserId;
    } else {
      return;
    }

    await this.giveChangePayoutService.executeGiveChangePayout(
      {
        amount: ctx.amount,
        currency: ctx.currency,
        description: `Comm order ${ctx.order.order_number}`,
        customerPhone: phone,
        accountId: ctx.accountId,
        mtnUserId,
        withdrawalMemoPrefix: 'Auto payout',
      },
      { throwOnWithdrawalFailure: false }
    );
  }

  private async getLocationAutoWithdraw(
    locationId: string
  ): Promise<{ auto_withdraw_commissions: boolean; phone?: string | null } | null> {
    const query = `
      query LocAutoWithdraw($id: uuid!) {
        business_locations_by_pk(id: $id) {
          auto_withdraw_commissions
          phone
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      id: locationId,
    });
    return res.business_locations_by_pk ?? null;
  }

  private async getAgentAutoWithdraw(
    userId: string
  ): Promise<{ auto_withdraw_commissions: boolean; phone?: string | null } | null> {
    const query = `
      query AgentAutoWithdraw($uid: uuid!) {
        agents(where: { user_id: { _eq: $uid } }, limit: 1) {
          auto_withdraw_commissions
          user { phone_number }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      uid: userId,
    });
    const row = res.agents?.[0];
    if (!row) return null;
    return {
      auto_withdraw_commissions: Boolean(row.auto_withdraw_commissions),
      phone: row.user?.phone_number,
    };
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
