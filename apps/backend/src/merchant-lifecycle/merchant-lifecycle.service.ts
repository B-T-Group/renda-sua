import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { BusinessContractsService } from '../business-contracts/business-contracts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { LaunchPromoService } from '../launch-promo/launch-promo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  aggregatePaymentCapability,
  aggregatePaymentCapabilityForProvider,
  deriveLifecycleStatus,
  deriveStorefrontVisibility,
  mapCapabilityStatusToDb,
  paymentProviderForRail,
} from './merchant-lifecycle-status.util';
import {
  BusinessLifecycleSnapshot,
  BusinessLifecycleStatus,
  BusinessPaymentProvider,
  BusinessSuspensionInfo,
  BusinessSuspensionReasonCode,
  DbPaymentCapabilityStatus,
  PaymentCapabilityStatus,
  SUSPENSION_REASON_RELIABILITY_MISSED_ORDERS,
} from './merchant-lifecycle.types';

const BUSINESS_FIELDS = `
  id
  name
  lifecycle_status
  can_accept_orders
  is_storefront_visible
  is_verified
  merchant_agreement_version
  merchant_agreement_accepted_at
  user { id email first_name last_name }
`;

@Injectable()
export class MerchantLifecycleService {
  private readonly logger = new Logger(MerchantLifecycleService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => PaymentRoutingService))
    private readonly paymentRoutingService: PaymentRoutingService,
    @Inject(forwardRef(() => BusinessContractsService))
    private readonly businessContractsService: BusinessContractsService,
    private readonly launchPromoService: LaunchPromoService
  ) {}

  async recompute(
    businessId: string,
    reason = 'system_recompute',
    changedByUserId?: string
  ): Promise<BusinessLifecycleSnapshot | null> {
    try {
      return await this.recomputeInternal(businessId, reason, changedByUserId);
    } catch (error: any) {
      this.logger.warn(
        `Lifecycle recompute failed for ${businessId}: ${error?.message}`
      );
      return null;
    }
  }

  async suspend(
    businessId: string,
    reason: string,
    adminUserId: string
  ): Promise<BusinessLifecycleSnapshot | null> {
    return this.applySuspend(businessId, reason, 'admin', adminUserId);
  }

  async suspendBySystem(
    businessId: string,
    reason: string = SUSPENSION_REASON_RELIABILITY_MISSED_ORDERS
  ): Promise<BusinessLifecycleSnapshot | null> {
    return this.applySuspend(businessId, reason, 'system');
  }

  async getLatestSuspension(
    businessId: string
  ): Promise<BusinessSuspensionInfo | null> {
    const row = await this.fetchLatestSuspendHistory(businessId);
    if (row) {
      return {
        code: this.mapSuspensionCode(row.reason, row.changed_by_type),
        suspendedAt: row.created_at ?? null,
      };
    }
    return this.inferSuspensionWithoutHistory(businessId);
  }

  async reinstate(
    businessId: string,
    adminUserId: string
  ): Promise<BusinessLifecycleSnapshot | null> {
    const current = await this.getBusinessSnapshot(businessId);
    if (!current || current.lifecycle_status !== 'suspended') {
      return current;
    }
    const next = deriveLifecycleStatus(
      await this.hasSignedContract(businessId),
      await this.resolvePaymentCapability(businessId)
    );
    await this.persistLifecycleState(businessId, next, true);
    await this.recordHistory({
      businessId,
      fromStatus: 'suspended',
      toStatus: next,
      reason: 'admin_reinstate',
      changedByType: 'admin',
      changedByUserId: adminUserId,
    });
    if (next === 'active') {
      await this.launchPromoService.confirmSlot(businessId);
    }
    await this.dispatchTransitionNotifications(current, next);
    return this.getBusinessSnapshot(businessId);
  }

  async upsertPaymentAccount(params: {
    businessId: string;
    provider: BusinessPaymentProvider;
    capabilityStatus: DbPaymentCapabilityStatus;
    externalReference?: string | null;
    rejectionReason?: string | null;
  }): Promise<void> {
    const previousStatus = await this.getPaymentAccountStatus(
      params.businessId,
      params.provider
    );
    await this.persistPaymentAccount(params);
    await this.recompute(params.businessId, `payment_account_${params.provider}`);
    const needsReviewEmail =
      params.capabilityStatus !== previousStatus &&
      (params.capabilityStatus === 'verification_pending' ||
        params.capabilityStatus === 'rejected');
    if (needsReviewEmail) {
      await this.notifyCapabilityChange(params);
    }
  }

  /**
   * Writes the payment account row without recomputing lifecycle or sending
   * emails. Shared by upsertPaymentAccount and the recompute-time MoMo sync
   * so the sync cannot recurse back into recompute.
   */
  private async persistPaymentAccount(params: {
    businessId: string;
    provider: BusinessPaymentProvider;
    capabilityStatus: DbPaymentCapabilityStatus;
    externalReference?: string | null;
    rejectionReason?: string | null;
  }): Promise<void> {
    const mutation = `
      mutation UpsertPaymentAccount($row: business_payment_accounts_insert_input!) {
        insert_business_payment_accounts_one(
          object: $row
          on_conflict: {
            constraint: uq_business_payment_accounts_business_provider
            update_columns: [capability_status, external_reference, rejection_reason, verified_at, updated_at]
          }
        ) { id }
      }
    `;
    const verifiedAt =
      params.capabilityStatus === 'verified' ? new Date().toISOString() : null;
    await this.hasuraSystemService.executeMutation(mutation, {
      row: {
        business_id: params.businessId,
        provider: params.provider,
        capability_status: params.capabilityStatus,
        external_reference: params.externalReference ?? null,
        rejection_reason: params.rejectionReason ?? null,
        verified_at: verifiedAt,
      },
    });
  }

  private async getPaymentAccountStatus(
    businessId: string,
    provider: BusinessPaymentProvider
  ): Promise<DbPaymentCapabilityStatus | null> {
    const query = `
      query PaymentAccountStatus($businessId: uuid!, $provider: business_payment_provider_enum!) {
        business_payment_accounts(
          where: { business_id: { _eq: $businessId }, provider: { _eq: $provider } }
          limit: 1
        ) { capability_status }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      businessId,
      provider,
    });
    return res.business_payment_accounts?.[0]?.capability_status ?? null;
  }

  async getBusinessSnapshot(
    businessId: string
  ): Promise<BusinessLifecycleSnapshot | null> {
    const query = `
      query BusinessLifecycle($id: uuid!) {
        businesses_by_pk(id: $id) { ${BUSINESS_FIELDS} }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      id: businessId,
    });
    const row = res.businesses_by_pk;
    if (!row) return null;
    return {
      ...row,
      is_storefront_visible: row.is_storefront_visible === true,
    };
  }

  async getBusinessIdForUser(userId: string): Promise<string | null> {
    const query = `
      query BizByUser($userId: uuid!) {
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) { id }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { userId });
    return res.businesses?.[0]?.id ?? null;
  }

  async listPaymentAccounts(businessId: string) {
    const query = `
      query PaymentAccounts($businessId: uuid!) {
        business_payment_accounts(where: { business_id: { _eq: $businessId } }) {
          id provider capability_status external_reference rejection_reason verified_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      businessId,
    });
    return res.business_payment_accounts ?? [];
  }

  private async recomputeInternal(
    businessId: string,
    reason: string,
    changedByUserId?: string
  ): Promise<BusinessLifecycleSnapshot | null> {
    const current = await this.getBusinessSnapshot(businessId);
    if (!current) return null;
    if (current.lifecycle_status === 'suspended') {
      await this.syncStorefrontVisibility(businessId, 'suspended');
      return this.getBusinessSnapshot(businessId);
    }
    const next = deriveLifecycleStatus(
      await this.hasSignedContract(businessId),
      await this.resolvePaymentCapability(businessId)
    );
    const statusChanged = next !== current.lifecycle_status;
    await this.persistLifecycleState(businessId, next, statusChanged);
    if (statusChanged) {
      await this.afterLifecycleTransition(current, next, reason, changedByUserId);
    }
    return this.getBusinessSnapshot(businessId);
  }

  private async afterLifecycleTransition(
    previous: BusinessLifecycleSnapshot,
    next: BusinessLifecycleStatus,
    reason: string,
    changedByUserId?: string
  ): Promise<void> {
    await this.recordHistory({
      businessId: previous.id,
      fromStatus: previous.lifecycle_status,
      toStatus: next,
      reason,
      changedByType: changedByUserId ? 'admin' : 'system',
      changedByUserId,
    });
    if (next === 'active') {
      await this.launchPromoService.confirmSlot(previous.id);
    }
    await this.dispatchTransitionNotifications(previous, next);
  }

  private async hasSignedContract(businessId: string): Promise<boolean> {
    // Signed agreement is the shared readiness gate. MoMo also needs an
    // approved ID (via resolveMoMoCapabilityFromIdentity). Products/rentals
    // and confirmed location phones are not required for lifecycle-active.
    return this.businessContractsService.hasValidSignedContract(businessId);
  }

  /**
   * Catalog inventory snapshot for UI/admin (location + items/rentals).
   * Not used as a hard gate for lifecycle activation.
   */
  async getCatalogStep(businessId: string): Promise<{
    complete: boolean;
    hasLocation: boolean;
    hasApprovedItem: boolean;
    hasPendingItem: boolean;
    hasApprovedRental: boolean;
    hasPendingRental: boolean;
  }> {
    const inventory = await this.queryCatalogInventory(businessId);
    const hasCatalogContent =
      inventory.hasApprovedItem || inventory.hasApprovedRental;
    return {
      complete: inventory.hasLocation && hasCatalogContent,
      hasLocation: inventory.hasLocation,
      hasApprovedItem: inventory.hasApprovedItem,
      hasPendingItem: inventory.hasPendingItem,
      hasApprovedRental: inventory.hasApprovedRental,
      hasPendingRental: inventory.hasPendingRental,
    };
  }

  private async queryCatalogInventory(businessId: string): Promise<{
    hasLocation: boolean;
    hasApprovedItem: boolean;
    hasPendingItem: boolean;
    hasApprovedRental: boolean;
    hasPendingRental: boolean;
  }> {
    const query = `
      query CatalogInventory($businessId: uuid!) {
        business_locations_aggregate(
          where: { business_id: { _eq: $businessId }, is_active: { _eq: true } }
        ) { aggregate { count } }
        approved: business_inventory_aggregate(
          where: {
            is_active: { _eq: true }
            business_location: { business_id: { _eq: $businessId }, is_active: { _eq: true } }
            item: {
              is_active: { _eq: true }
              status: { _eq: active }
              moderation_status: { _eq: approved }
            }
          }
        ) { aggregate { count } }
        pending: business_inventory_aggregate(
          where: {
            is_active: { _eq: true }
            business_location: { business_id: { _eq: $businessId }, is_active: { _eq: true } }
            item: {
              status: { _eq: active }
              moderation_status: { _in: [pending, ai_reviewing, proposal_pending] }
            }
          }
        ) { aggregate { count } }
        approved_rentals: rental_location_listings_aggregate(
          where: {
            is_active: { _eq: true }
            deleted_at: { _is_null: true }
            moderation_status: { _eq: approved }
            business_location: {
              business_id: { _eq: $businessId }
              is_active: { _eq: true }
            }
            rental_item: {
              is_active: { _eq: true }
              deleted_at: { _is_null: true }
            }
          }
        ) { aggregate { count } }
        pending_rentals: rental_location_listings_aggregate(
          where: {
            is_active: { _eq: true }
            deleted_at: { _is_null: true }
            moderation_status: { _in: [pending, ai_reviewing, proposal_pending] }
            business_location: {
              business_id: { _eq: $businessId }
              is_active: { _eq: true }
            }
            rental_item: { deleted_at: { _is_null: true } }
          }
        ) { aggregate { count } }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { businessId });
    return {
      hasLocation: (res.business_locations_aggregate?.aggregate?.count ?? 0) > 0,
      hasApprovedItem: (res.approved?.aggregate?.count ?? 0) > 0,
      hasPendingItem: (res.pending?.aggregate?.count ?? 0) > 0,
      hasApprovedRental: (res.approved_rentals?.aggregate?.count ?? 0) > 0,
      hasPendingRental: (res.pending_rentals?.aggregate?.count ?? 0) > 0,
    };
  }

  private async resolvePaymentCapability(
    businessId: string
  ): Promise<PaymentCapabilityStatus> {
    const userId = await this.getBusinessUserId(businessId);
    if (!userId) {
      const accounts = await this.listPaymentAccounts(businessId);
      if (!accounts.length) return 'NOT_STARTED';
      return aggregatePaymentCapability(
        accounts.map(
          (a: { capability_status: DbPaymentCapabilityStatus }) =>
            a.capability_status
        )
      );
    }

    const rail = await this.paymentRoutingService.resolveRailForUser(userId);
    // MoMo account activation is identity-based (agreement + approved ID).
    // Confirmed phones gate locations, not the business payment account row.
    if (rail === 'mobile_money') {
      const identity = await this.resolveMoMoCapabilityFromIdentity(userId);
      await this.syncMoMoPaymentAccount(businessId, identity);
      return identity.status;
    }

    const accounts = await this.listPaymentAccounts(businessId);
    if (!accounts.length) return 'NOT_STARTED';
    const provider = paymentProviderForRail(rail);
    return aggregatePaymentCapabilityForProvider(accounts, provider);
  }

  /**
   * Maps ID document review state to the payment-capability slot used by
   * deriveLifecycleStatus. Location payout readiness is separate.
   */
  private async resolveMoMoCapabilityFromIdentity(userId: string): Promise<{
    status: PaymentCapabilityStatus;
    rejectionReason: string | null;
  }> {
    const idNames = ['id_card', 'passport', 'driver_license'];
    const res = await this.hasuraSystemService.executeQuery(
      `query MoMoIdCapability($userId: uuid!, $names: [String!]) {
        user_uploads(
          where: {
            user_id: { _eq: $userId }
            document_type: { name: { _in: $names } }
          }
          order_by: { created_at: desc }
        ) {
          is_approved
          note
        }
      }`,
      { userId, names: idNames }
    );
    const uploads = (res.user_uploads ?? []) as Array<{
      is_approved: boolean;
      note: string | null;
    }>;
    if (!uploads.length) return { status: 'NOT_STARTED', rejectionReason: null };
    if (uploads.some((u) => u.is_approved)) {
      return { status: 'VERIFIED', rejectionReason: null };
    }
    const note = uploads[0]?.note?.trim() ?? '';
    if (note.startsWith('[REJECTED]') || note.length > 0) {
      return {
        status: 'REJECTED',
        rejectionReason: note.replace(/^\[REJECTED\]\s*/, '') || null,
      };
    }
    return { status: 'VERIFICATION_PENDING', rejectionReason: null };
  }

  /**
   * Mirrors the identity-derived MoMo capability into the mobile_money
   * payment account row and emails review-state changes exactly once per
   * change. Writes via persistPaymentAccount (no recompute) — never recurses.
   */
  private async syncMoMoPaymentAccount(
    businessId: string,
    identity: { status: PaymentCapabilityStatus; rejectionReason: string | null }
  ): Promise<void> {
    const status = mapCapabilityStatusToDb(identity.status);
    const previous = await this.getPaymentAccountStatus(
      businessId,
      'mobile_money'
    );
    if (previous === status || (!previous && status === 'not_started')) return;
    await this.persistPaymentAccount({
      businessId,
      provider: 'mobile_money',
      capabilityStatus: status,
      rejectionReason: identity.rejectionReason,
    });
    if (status === 'verification_pending' || status === 'rejected') {
      await this.notifyCapabilityChange({
        businessId,
        capabilityStatus: status,
        rejectionReason: identity.rejectionReason,
      });
    }
  }

  private async getBusinessUserId(businessId: string): Promise<string | null> {
    const query = `
      query BusinessUser($id: uuid!) {
        businesses_by_pk(id: $id) { user_id }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      id: businessId,
    });
    return res.businesses_by_pk?.user_id ?? null;
  }

  private async applySuspend(
    businessId: string,
    reason: string,
    changedByType: 'system' | 'admin',
    changedByUserId?: string
  ): Promise<BusinessLifecycleSnapshot | null> {
    const current = await this.getBusinessSnapshot(businessId);
    if (!current) return null;
    if (current.lifecycle_status === 'suspended') return current;
    await this.persistLifecycleState(businessId, 'suspended', true);
    await this.recordHistory({
      businessId,
      fromStatus: current.lifecycle_status,
      toStatus: 'suspended',
      reason,
      changedByType,
      changedByUserId,
    });
    return this.getBusinessSnapshot(businessId);
  }

  private async fetchLatestSuspendHistory(businessId: string): Promise<{
    reason?: string | null;
    changed_by_type?: string | null;
    created_at?: string | null;
  } | null> {
    const query = `
      query LatestSuspend($id: uuid!) {
        business_lifecycle_status_history(
          where: { business_id: { _eq: $id }, to_status: { _eq: suspended } }
          order_by: { created_at: desc }
          limit: 1
        ) {
          reason
          changed_by_type
          created_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      id: businessId,
    });
    return res.business_lifecycle_status_history?.[0] ?? null;
  }

  private mapSuspensionCode(
    reason: string | null | undefined,
    changedByType: string | null | undefined
  ): BusinessSuspensionReasonCode {
    if (
      reason === SUSPENSION_REASON_RELIABILITY_MISSED_ORDERS ||
      reason?.startsWith('reliability_')
    ) {
      return 'reliability_missed_orders';
    }
    if (changedByType === 'admin') return 'admin';
    return 'unknown';
  }

  private async inferSuspensionWithoutHistory(
    businessId: string
  ): Promise<BusinessSuspensionInfo | null> {
    const query = `
      query BizTier($id: uuid!) {
        businesses_by_pk(id: $id) {
          lifecycle_status
          reliability_tier
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      id: businessId,
    });
    const biz = res.businesses_by_pk;
    if (!biz || biz.lifecycle_status !== 'suspended') return null;
    return {
      code:
        biz.reliability_tier === 'suspend'
          ? 'reliability_missed_orders'
          : 'unknown',
      suspendedAt: null,
    };
  }

  /**
   * Persist lifecycle status and storefront visibility in one mutation when
   * the status changes, so a failed visibility write cannot leave them split.
   */
  private async persistLifecycleState(
    businessId: string,
    status: BusinessLifecycleStatus,
    updateStatus: boolean
  ): Promise<void> {
    const visible = deriveStorefrontVisibility(status);
    if (updateStatus) {
      const mutation = `
        mutation SetLifecycleAndVisibility(
          $id: uuid!
          $status: business_lifecycle_status_enum!
          $visible: Boolean!
        ) {
          update_businesses_by_pk(
            pk_columns: { id: $id }
            _set: { lifecycle_status: $status, is_storefront_visible: $visible }
          ) { id }
        }
      `;
      await this.hasuraSystemService.executeMutation(mutation, {
        id: businessId,
        status,
        visible,
      });
      return;
    }
    await this.syncStorefrontVisibility(businessId, status, visible);
  }

  private async syncStorefrontVisibility(
    businessId: string,
    lifecycleStatus: BusinessLifecycleStatus,
    knownVisible?: boolean
  ): Promise<void> {
    const visible = knownVisible ?? deriveStorefrontVisibility(lifecycleStatus);
    const mutation = `
      mutation SetStorefrontVisible($id: uuid!, $visible: Boolean!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: { is_storefront_visible: $visible }
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      id: businessId,
      visible,
    });
  }

  private async recordHistory(params: {
    businessId: string;
    fromStatus: BusinessLifecycleStatus | null;
    toStatus: BusinessLifecycleStatus;
    reason: string;
    changedByType: 'system' | 'admin';
    changedByUserId?: string;
  }): Promise<void> {
    const mutation = `
      mutation InsertLifecycleHistory($row: business_lifecycle_status_history_insert_input!) {
        insert_business_lifecycle_status_history_one(object: $row) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      row: {
        business_id: params.businessId,
        from_status: params.fromStatus,
        to_status: params.toStatus,
        reason: params.reason,
        changed_by_type: params.changedByType,
        changed_by_user_id: params.changedByUserId ?? null,
      },
    });
  }

  private async dispatchTransitionNotifications(
    previous: BusinessLifecycleSnapshot,
    next: BusinessLifecycleStatus
  ): Promise<void> {
    if (previous.lifecycle_status === next) return;
    const email = previous.user?.email?.trim();
    if (!email) return;

    if (next === 'active') {
      await this.notificationsService.sendMerchantActivatedEmail({
        to: email,
        businessName: previous.name,
      });
    }
  }

  /**
   * Payment review emails are driven by capability changes (Stripe sync,
   * admin review), not lifecycle transitions: the lifecycle no longer has a
   * payment_verification_pending status.
   */
  private async notifyCapabilityChange(params: {
    businessId: string;
    capabilityStatus: DbPaymentCapabilityStatus;
    rejectionReason?: string | null;
  }): Promise<void> {
    const snapshot = await this.getBusinessSnapshot(params.businessId);
    const email = snapshot?.user?.email?.trim();
    if (!snapshot || !email || snapshot.lifecycle_status === 'active') return;
    // Review emails presuppose a signed contract: merchants still in
    // `created` (nothing signed yet) must not receive payment-review emails.
    if (!(await this.hasSignedContract(params.businessId))) return;

    if (params.capabilityStatus === 'rejected') {
      await this.notificationsService.sendMerchantPaymentVerificationFailedEmail(
        {
          to: email,
          businessName: snapshot.name,
          reason: params.rejectionReason,
        }
      );
      return;
    }
    await this.notificationsService.sendMerchantPaymentReviewPendingEmail({
      to: email,
      businessName: snapshot.name,
    });
    await this.notificationsService.sendAdminMerchantReviewPendingEmail({
      businessName: snapshot.name,
      businessId: snapshot.id,
    });
  }
}
