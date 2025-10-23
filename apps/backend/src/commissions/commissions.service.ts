import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { Partners } from './generated-types';
import { CommissionBreakdown, CommissionConfig } from './types';

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    private readonly accountsService: AccountsService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  /**
   * Calculate commission breakdown for an order
   */
  async calculateCommissions(order: any): Promise<CommissionBreakdown> {
    try {
      // Get commission configurations
      const config = await this.getCommissionConfigs();

      // Get active partners
      const partners = await this.getActivePartners();

      // Calculate base delivery fee commissions
      const baseDeliveryFeeBreakdown = this.calculateBaseDeliveryFeeCommissions(
        order.base_delivery_fee,
        order.assigned_agent?.is_verified || false,
        config,
        partners
      );

      // Calculate per-km delivery fee commissions
      const perKmDeliveryFeeBreakdown =
        this.calculatePerKmDeliveryFeeCommissions(
          order.per_km_delivery_fee,
          order.assigned_agent?.is_verified || false,
          config,
          partners
        );

      // Calculate item commission (on RendaSua's portion)
      const itemCommissionBreakdown = this.calculateItemCommission(
        order.subtotal,
        config.rendasuaItemCommissionPercentage,
        partners
      );

      // Calculate order subtotal breakdown
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
   * Distribute commissions for a completed order
   */
  async distributeCommissions(order: any): Promise<void> {
    try {
      this.logger.log(
        `Starting commission distribution for order ${order.order_number}`
      );

      // Calculate commission breakdown
      const breakdown = await this.calculateCommissions(order);

      // Get RendaSua HQ user
      const rendasuaHQUser = await this.getRendasuaHQUser();
      if (!rendasuaHQUser) {
        throw new Error('RendaSua HQ user not found');
      }

      // Get active partners
      const partners = await this.getActivePartners();

      // Process base delivery fee commissions
      await this.processBaseDeliveryFeeCommissions(
        order,
        breakdown.baseDeliveryFee,
        rendasuaHQUser,
        partners
      );

      // Process per-km delivery fee commissions
      await this.processPerKmDeliveryFeeCommissions(
        order,
        breakdown.perKmDeliveryFee,
        rendasuaHQUser,
        partners
      );

      // Process item commissions
      await this.processItemCommissions(
        order,
        breakdown.itemCommission,
        rendasuaHQUser,
        partners
      );

      // Process order subtotal (business payment)
      await this.processOrderSubtotalPayment(
        order,
        breakdown.orderSubtotal,
        rendasuaHQUser
      );

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
          user_type_id
          identifier
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
   * Get commission configurations
   */
  async getCommissionConfigs(): Promise<CommissionConfig> {
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

    return {
      rendasuaItemCommissionPercentage:
        configMap.rendasua_item_commission_percentage || 5.0,
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
    partners: Partners[]
  ): { agent: number; partner: number; rendasua: number } {
    const agentCommission = isAgentVerified
      ? config.verifiedAgentBaseDeliveryCommission
      : config.unverifiedAgentBaseDeliveryCommission;

    const agentAmount = (baseDeliveryFee * agentCommission) / 100;

    // Calculate partner commissions
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
   * Process item commissions
   */
  private async processItemCommissions(
    order: any,
    breakdown: { partner: number; rendasua: number },
    rendasuaHQUser: any,
    partners: Partners[]
  ): Promise<void> {
    // Pay partners
    for (const partner of partners) {
      const rendasuaItemAmount = (order.subtotal * 5.0) / 100; // 5% RendaSua commission
      const partnerAmount =
        (rendasuaItemAmount * partner.item_commission) / 100;
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

    // Pay RendaSua HQ
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
   * Process order subtotal payment
   */
  private async processOrderSubtotalPayment(
    order: any,
    breakdown: { business: number; rendasua: number },
    rendasuaHQUser: any
  ): Promise<void> {
    // Pay business (subtotal minus RendaSua's 5%)
    if (breakdown.business > 0) {
      await this.payCommission(
        order,
        order.business.user_id,
        'business',
        'order_subtotal',
        breakdown.business,
        order.currency
      );
    }

    // Pay RendaSua HQ (5% of subtotal)
    if (breakdown.rendasua > 0) {
      await this.payCommission(
        order,
        rendasuaHQUser.id,
        'rendasua',
        'order_subtotal',
        breakdown.rendasua,
        order.currency
      );
    }
  }

  /**
   * Pay commission to a recipient
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
    commissionPercentage?: number
  ): Promise<void> {
    try {
      // Get recipient account
      const account = await this.hasuraSystemService.getAccount(
        recipientUserId,
        currency
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
    } catch (error: any) {
      this.logger.error(
        `Failed to pay commission to ${recipientType}: ${error.message}`
      );
      throw error;
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
