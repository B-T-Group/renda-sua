import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { MERCHANT_AGREEMENT_VERSION } from '../agreements/merchant-agreement.constants';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  aggregatePaymentCapability,
  aggregatePaymentCapabilityForProvider,
  deriveLifecycleStatus,
  paymentProviderForRail,
} from './merchant-lifecycle-status.util';
import {
  BusinessLifecycleSnapshot,
  BusinessLifecycleStatus,
  BusinessPaymentProvider,
  DbPaymentCapabilityStatus,
  PaymentCapabilityStatus,
} from './merchant-lifecycle.types';

const BUSINESS_FIELDS = `
  id
  name
  lifecycle_status
  is_storefront_visible
  can_accept_orders
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
    private readonly paymentRoutingService: PaymentRoutingService
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
    const current = await this.getBusinessSnapshot(businessId);
    if (!current) return null;
    await this.setLifecycleStatus(businessId, 'suspended');
    await this.recordHistory({
      businessId,
      fromStatus: current.lifecycle_status,
      toStatus: 'suspended',
      reason,
      changedByType: 'admin',
      changedByUserId: adminUserId,
    });
    return this.getBusinessSnapshot(businessId);
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
      await this.isCatalogReady(businessId),
      await this.resolvePaymentCapability(businessId)
    );
    await this.setLifecycleStatus(businessId, next);
    await this.recordHistory({
      businessId,
      fromStatus: 'suspended',
      toStatus: next,
      reason: 'admin_reinstate',
      changedByType: 'admin',
      changedByUserId: adminUserId,
    });
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
    await this.recompute(params.businessId, `payment_account_${params.provider}`);
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
    return res.businesses_by_pk ?? null;
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
    if (current.lifecycle_status === 'suspended') return current;

    const catalogReady = await this.isCatalogReady(businessId);
    const paymentCapability = await this.resolvePaymentCapability(businessId);
    const next = deriveLifecycleStatus(catalogReady, paymentCapability);

    if (next === current.lifecycle_status) return current;

    await this.setLifecycleStatus(businessId, next);
    await this.recordHistory({
      businessId,
      fromStatus: current.lifecycle_status,
      toStatus: next,
      reason,
      changedByType: changedByUserId ? 'admin' : 'system',
      changedByUserId,
    });
    await this.dispatchTransitionNotifications(current, next);
    return this.getBusinessSnapshot(businessId);
  }

  private async isCatalogReady(businessId: string): Promise<boolean> {
    const query = `
      query CatalogReady($businessId: uuid!, $version: String!) {
        businesses_by_pk(id: $businessId) {
          merchant_agreement_version
          merchant_agreement_accepted_at
        }
        business_locations_aggregate(
          where: { business_id: { _eq: $businessId }, is_active: { _eq: true } }
        ) { aggregate { count } }
        business_inventory_aggregate(
          where: {
            is_active: { _eq: true }
            business_location: { business_id: { _eq: $businessId }, is_active: { _eq: true } }
            item: { is_active: { _eq: true }, status: { _eq: active } }
          }
        ) { aggregate { count } }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      businessId,
      version: MERCHANT_AGREEMENT_VERSION,
    });
    const biz = res.businesses_by_pk;
    if (!biz?.merchant_agreement_accepted_at) return false;
    if (biz.merchant_agreement_version !== MERCHANT_AGREEMENT_VERSION) {
      return false;
    }
    const locCount = res.business_locations_aggregate?.aggregate?.count ?? 0;
    const invCount = res.business_inventory_aggregate?.aggregate?.count ?? 0;
    return locCount > 0 && invCount > 0;
  }

  private async resolvePaymentCapability(
    businessId: string
  ): Promise<PaymentCapabilityStatus> {
    const accounts = await this.listPaymentAccounts(businessId);
    if (!accounts.length) return 'NOT_STARTED';

    const userId = await this.getBusinessUserId(businessId);
    if (!userId) {
      return aggregatePaymentCapability(
        accounts.map(
          (a: { capability_status: DbPaymentCapabilityStatus }) =>
            a.capability_status
        )
      );
    }

    const rail = await this.paymentRoutingService.resolveRailForUser(userId);
    const provider = paymentProviderForRail(rail);
    return aggregatePaymentCapabilityForProvider(accounts, provider);
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

  private async setLifecycleStatus(
    businessId: string,
    status: BusinessLifecycleStatus
  ): Promise<void> {
    const mutation = `
      mutation SetLifecycle($id: uuid!, $status: business_lifecycle_status_enum!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: { lifecycle_status: $status }
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      id: businessId,
      status,
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
      return;
    }

    if (
      next === 'payment_verification_pending' &&
      previous.lifecycle_status !== 'payment_verification_pending'
    ) {
      const accounts = await this.listPaymentAccounts(previous.id);
      const rejected = accounts.find(
        (a: { capability_status: string }) => a.capability_status === 'rejected'
      );
      if (rejected) {
        await this.notificationsService.sendMerchantPaymentVerificationFailedEmail({
          to: email,
          businessName: previous.name,
          reason: rejected.rejection_reason,
        });
      } else {
        await this.notificationsService.sendMerchantPaymentReviewPendingEmail({
          to: email,
          businessName: previous.name,
        });
        await this.notificationsService.sendAdminMerchantReviewPendingEmail({
          businessName: previous.name,
          businessId: previous.id,
        });
      }
    }
  }
}
