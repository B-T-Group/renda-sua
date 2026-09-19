import { BadRequestException, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeLanguage } from '../notifications/email-template-data';
import {
  allocatePurchaseCredits,
  type CreditAllocation,
  type CreditLine,
} from './purchase-credit.allocator';
import { creditGrantCopy, scopeLabel } from './payment-program.messages';

interface GrantRow {
  id: string;
  remaining_amount: number;
  applicability: 'any_store' | 'partner_businesses' | 'specific_business';
  business_id: string | null;
  expires_at: string | null;
  created_at: string;
  currency: string;
  amount: number;
  memo: string | null;
  business?: { name: string } | null;
}

@Injectable()
export class PurchaseCreditsService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly notifications: NotificationsService
  ) {}

  async plan(input: {
    userId: string;
    currency: string;
    lines: CreditLine[];
    maxTotal: number;
  }): Promise<{ total: number; allocations: CreditAllocation[] }> {
    const [grants, partnerIds] = await Promise.all([
      this.loadGrants(input.userId, input.currency),
      this.activePartnerIds(),
    ]);
    return allocatePurchaseCredits({
      lines: input.lines,
      grants: grants.map(toGrantInput),
      partnerBusinessIds: partnerIds,
      maxTotal: input.maxTotal,
    });
  }

  async commit(orderId: string, allocations: CreditAllocation[]): Promise<void> {
    for (const allocation of allocations) {
      await this.redeemOne(orderId, allocation);
    }
  }

  async restore(orderId: string): Promise<void> {
    const rows = await this.redemptionsForOrder(orderId);
    for (const row of rows) {
      await this.restoreOne(row);
    }
  }

  async listForUser(userId: string): Promise<GrantRow[]> {
    const result = await this.hasura.executeQuery(LIST_GRANTS, { userId });
    return result.purchase_credit_grants ?? [];
  }

  async grant(input: GrantInput): Promise<{ id: string }> {
    await this.assertClient(input.userId);
    await this.assertSpecificPartner(input);
    const row = await this.insertGrant(input);
    await this.notifyGrant(input, row.id);
    return { id: row.id };
  }

  async searchClients(search: string) {
    const term = search.trim();
    if (term.length < 2) return [];
    const result = await this.hasura.executeQuery(SEARCH_CLIENTS, {
      where: clientSearchWhere(term),
      limit: 8,
    });
    return (result.clients ?? []).map(mapClientOption);
  }

  private async redeemOne(orderId: string, allocation: CreditAllocation): Promise<void> {
    await this.hasura.executeMutation(INSERT_REDEMPTION, {
      grantId: allocation.grantId,
      orderId,
      amount: allocation.amount,
    });
    await this.hasura.executeMutation(ADJUST_REMAINING, {
      id: allocation.grantId,
      delta: -allocation.amount,
    });
  }

  private async restoreOne(row: { id: string; grant_id: string; amount: number }): Promise<void> {
    await this.hasura.executeMutation(ADJUST_REMAINING, {
      id: row.grant_id,
      delta: row.amount,
    });
    await this.hasura.executeMutation(DELETE_REDEMPTION, { id: row.id });
  }

  private async loadGrants(userId: string, currency: string): Promise<GrantRow[]> {
    const result = await this.hasura.executeQuery(ACTIVE_GRANTS, { userId, currency });
    return result.purchase_credit_grants ?? [];
  }

  private async activePartnerIds(): Promise<Set<string>> {
    const result = await this.hasura.executeQuery(ACTIVE_PARTNERS, {});
    const rows = result.partner_businesses ?? [];
    return new Set(rows.map((row: { business_id: string }) => row.business_id));
  }

  private async redemptionsForOrder(orderId: string) {
    const result = await this.hasura.executeQuery(REDEMPTIONS, { orderId });
    return result.purchase_credit_redemptions ?? [];
  }

  private async assertClient(userId: string): Promise<void> {
    const result = await this.hasura.executeQuery(CLIENT_BY_USER, { userId });
    if (!result.clients?.length) {
      throw new BadRequestException('Purchase credits can only be granted to clients');
    }
  }

  private async assertSpecificPartner(input: GrantInput): Promise<void> {
    if (input.applicability !== 'specific_business') return;
    const result = await this.hasura.executeQuery(PARTNER_ACTIVE, {
      businessId: input.businessId,
    });
    if (!result.partner_businesses?.length) {
      throw new BadRequestException('Specific credits must target an active partner business');
    }
  }

  private async insertGrant(input: GrantInput): Promise<{ id: string }> {
    const result = await this.hasura.executeMutation(INSERT_GRANT, {
      object: {
        user_id: input.userId,
        currency: input.currency,
        amount: input.amount,
        remaining_amount: input.amount,
        applicability: input.applicability,
        business_id: input.applicability === 'specific_business' ? input.businessId : null,
        expires_at: input.expiresAt ?? null,
        source: 'admin',
        memo: input.memo ?? null,
        created_by: input.createdBy ?? null,
      },
    });
    return result.insert_purchase_credit_grants_one;
  }

  private async notifyGrant(input: GrantInput, grantId: string): Promise<void> {
    const locale = normalizeLanguage(input.preferredLanguage);
    const copy = creditGrantCopy({
      amount: input.amount,
      currency: input.currency,
      scopeLabel: scopeLabel(input.applicability, input.businessName ?? null, locale),
      preferredLanguage: input.preferredLanguage,
    });
    await this.notifications.sendPaymentProgramNotice({
      userId: input.userId,
      title: copy.title,
      body: copy.body,
      messageType: 'PURCHASE_CREDIT',
      entityId: grantId,
      path: '/accounts/credits',
      event: 'wallet.purchase_credit.granted',
    });
  }
}

export interface GrantInput {
  userId: string;
  currency: string;
  amount: number;
  applicability: 'any_store' | 'partner_businesses' | 'specific_business';
  businessId?: string | null;
  businessName?: string | null;
  expiresAt?: string | null;
  memo?: string | null;
  createdBy?: string | null;
  preferredLanguage?: string | null;
}

function toGrantInput(row: GrantRow) {
  return {
    id: row.id,
    remainingAmount: Number(row.remaining_amount),
    applicability: row.applicability,
    businessId: row.business_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

const ACTIVE_GRANTS = `
  query ActivePurchaseCredits($userId: uuid!, $currency: currency_enum!) {
    purchase_credit_grants(
      where: {
        user_id: { _eq: $userId }
        currency: { _eq: $currency }
        remaining_amount: { _gt: 0 }
      }
    ) {
      id remaining_amount applicability business_id expires_at created_at
    }
  }
`;

const LIST_GRANTS = `
  query ListPurchaseCredits($userId: uuid!) {
    purchase_credit_grants(
      where: { user_id: { _eq: $userId } }
      order_by: { created_at: desc }
    ) {
      id currency amount remaining_amount applicability business_id expires_at
      source memo created_at
      business { name }
      redemptions(order_by: { created_at: desc }) { id order_id amount created_at }
    }
  }
`;

const ACTIVE_PARTNERS = `
  query ActivePartnerBusinesses {
    partner_businesses(where: { is_active: { _eq: true } }) { business_id }
  }
`;

const PARTNER_ACTIVE = `
  query PartnerActive($businessId: uuid!) {
    partner_businesses(where: { business_id: { _eq: $businessId }, is_active: { _eq: true } }) { id }
  }
`;

const INSERT_GRANT = `
  mutation InsertPurchaseCredit($object: purchase_credit_grants_insert_input!) {
    insert_purchase_credit_grants_one(object: $object) { id }
  }
`;

const INSERT_REDEMPTION = `
  mutation InsertRedemption($grantId: uuid!, $orderId: uuid!, $amount: numeric!) {
    insert_purchase_credit_redemptions_one(object: {
      grant_id: $grantId, order_id: $orderId, amount: $amount
    }) { id }
  }
`;

const ADJUST_REMAINING = `
  mutation AdjustCreditRemaining($id: uuid!, $delta: numeric!) {
    update_purchase_credit_grants_by_pk(pk_columns: { id: $id }, _inc: { remaining_amount: $delta }) { id }
  }
`;

const REDEMPTIONS = `
  query RedemptionsForOrder($orderId: uuid!) {
    purchase_credit_redemptions(where: { order_id: { _eq: $orderId } }) {
      id grant_id amount
    }
  }
`;

const DELETE_REDEMPTION = `
  mutation DeleteRedemption($id: uuid!) {
    delete_purchase_credit_redemptions_by_pk(id: $id) { id }
  }
`;

const CLIENT_BY_USER = `
  query ClientByUser($userId: uuid!) {
    clients(where: { user_id: { _eq: $userId } }, limit: 1) { id }
  }
`;

function clientSearchWhere(term: string) {
  return {
    _and: term.split(/\s+/).filter(Boolean).map((token) => ({
      _or: clientTokenMatches(`%${token}%`),
    })),
  };
}

function clientTokenMatches(pattern: string) {
  return [
    { user: { email: { _ilike: pattern } } },
    { user: { first_name: { _ilike: pattern } } },
    { user: { last_name: { _ilike: pattern } } },
    { user: { phone_number: { _ilike: pattern } } },
  ];
}

function mapClientOption(row: {
  id: string;
  user_id: string;
  user?: { first_name?: string; last_name?: string; email?: string; phone_number?: string | null };
}) {
  const user = row.user ?? {};
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return {
    id: row.id,
    userId: row.user_id,
    name: name || user.email || row.id,
    email: user.email ?? '',
    phone: user.phone_number ?? null,
  };
}

const SEARCH_CLIENTS = `
  query SearchPaymentProgramClients($where: clients_bool_exp!, $limit: Int!) {
    clients(where: $where, limit: $limit, order_by: { created_at: desc }) {
      id user_id
      user { first_name last_name email phone_number }
    }
  }
`;
