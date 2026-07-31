import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { GiveChangePayoutService } from '../mobile-payments/give-change-payout.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  isSupportedMobileMoneyE164,
  normalizeToE164,
} from './phone-e164.util';
import type {
  MobilePaymentPhoneVerificationStatus,
  UserMobilePaymentPhoneRow,
} from './mobile-payment-phones.types';

const XAF = 'XAF';
const VERIFICATION_AMOUNT = 150;
const VERIFICATION_PENDING_REUSE_MS = 15 * 60 * 1000;
const ID_DOC_NAMES = ['id_card', 'passport', 'driver_license'];

@Injectable()
export class MobilePaymentPhonesService {
  private readonly logger = new Logger(MobilePaymentPhonesService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly mobilePaymentsDatabaseService: MobilePaymentsDatabaseService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly giveChangePayoutService: GiveChangePayoutService,
    private readonly merchantLifecycleService: MerchantLifecycleService,
    private readonly paymentRoutingService: PaymentRoutingService
  ) {}

  async listForUser(userId: string): Promise<UserMobilePaymentPhoneRow[]> {
    const res = await this.hasuraSystemService.executeQuery(
      `query ListPhones($userId: uuid!) {
        user_mobile_payment_phones(
          where: { user_id: { _eq: $userId } }
          order_by: { created_at: desc }
        ) {
          id user_id phone_e164 is_verified verified_at
          last_verification_transaction_id created_at updated_at
        }
      }`,
      { userId }
    );
    return res.user_mobile_payment_phones ?? [];
  }

  async getByIdForUser(
    userId: string,
    phoneId: string
  ): Promise<UserMobilePaymentPhoneRow> {
    const row = await this.fetchPhoneForUser(userId, phoneId);
    if (!row) throw new NotFoundException('Mobile payment phone not found');
    return row;
  }

  async createForUser(
    userId: string,
    countryCode: string,
    phoneNumber: string
  ): Promise<UserMobilePaymentPhoneRow> {
    const phoneE164 = this.requireE164(countryCode, phoneNumber);
    await this.assertMobileMoneyRail(userId);
    this.assertProviderSupports(phoneE164);
    const existing = await this.findByUserAndE164(userId, phoneE164);
    if (existing) return existing;
    const res = await this.hasuraSystemService.executeMutation(
      `mutation InsertPhone($row: user_mobile_payment_phones_insert_input!) {
        insert_user_mobile_payment_phones_one(object: $row) {
          id user_id phone_e164 is_verified verified_at
          last_verification_transaction_id created_at updated_at
        }
      }`,
      { row: { user_id: userId, phone_e164: phoneE164, is_verified: false } }
    );
    return res.insert_user_mobile_payment_phones_one;
  }

  async updateForUser(
    userId: string,
    phoneId: string,
    countryCode: string,
    phoneNumber: string
  ): Promise<UserMobilePaymentPhoneRow> {
    await this.getByIdForUser(userId, phoneId);
    const phoneE164 = this.requireE164(countryCode, phoneNumber);
    this.assertProviderSupports(phoneE164);
    const duplicate = await this.findByUserAndE164(userId, phoneE164);
    if (duplicate && duplicate.id !== phoneId) {
      throw new ConflictException('This phone number already exists on your account');
    }
    const res = await this.hasuraSystemService.executeMutation(
      `mutation UpdatePhone($id: uuid!, $phone: String!) {
        update_user_mobile_payment_phones_by_pk(
          pk_columns: { id: $id }
          _set: {
            phone_e164: $phone
            is_verified: false
            verified_at: null
            last_verification_transaction_id: null
          }
        ) {
          id user_id phone_e164 is_verified verified_at
          last_verification_transaction_id created_at updated_at
        }
      }`,
      { id: phoneId, phone: phoneE164 }
    );
    await this.syncLocationPhonesFromRegistry(phoneId, phoneE164);
    await this.onVerificationLost(userId);
    return res.update_user_mobile_payment_phones_by_pk;
  }

  async deleteForUser(userId: string, phoneId: string): Promise<void> {
    await this.getByIdForUser(userId, phoneId);
    const refs = await this.countReferences(phoneId);
    if (refs > 0) {
      throw new ConflictException(
        'Unlink this number from all locations and your agent profile before deleting'
      );
    }
    await this.hasuraSystemService.executeMutation(
      `mutation DeletePhone($id: uuid!) {
        delete_user_mobile_payment_phones_by_pk(id: $id) { id }
      }`,
      { id: phoneId }
    );
  }

  async initiateVerification(
    userId: string,
    phoneId: string
  ): Promise<{
    transactionId: string;
    providerTransactionId?: string;
    provider?: string;
    message?: string;
  }> {
    const phone = await this.getByIdForUser(userId, phoneId);
    if (phone.is_verified) {
      throw new BadRequestException('Phone number is already verified');
    }
    if (phone.last_verification_transaction_id) {
      const existingTx =
        await this.mobilePaymentsDatabaseService.getTransactionById(
          phone.last_verification_transaction_id
        );
      if (existingTx?.payment_entity === 'phone_verification') {
        if (
          existingTx.status === 'pending' &&
          this.isRecentVerificationPendingTx(existingTx)
        ) {
          return {
            transactionId: existingTx.id,
            providerTransactionId: existingTx.transaction_id ?? undefined,
            provider: existingTx.provider ?? undefined,
            message: 'Verification payment already in progress',
          };
        }
        if (existingTx.status === 'success') {
          await this.completeVerificationFromTransaction(phoneId, existingTx.id);
          const refreshed = await this.getByIdForUser(userId, phoneId);
          if (refreshed.is_verified) {
            throw new BadRequestException('Phone number is already verified');
          }
          return {
            transactionId: existingTx.id,
            providerTransactionId: existingTx.transaction_id ?? undefined,
            provider: existingTx.provider ?? undefined,
            message: 'Verification payment received; finishing setup',
          };
        }
      }
    }
    await this.assertMobileMoneyRail(userId);
    const hqAccount = await this.resolveHqAccount();
    const reference = this.generateReference();
    const provider = this.mobilePaymentsService.getProvider(phone.phone_e164);
    const callbackBase = process.env.API_BASE_URL || 'http://localhost:3000';
    const callbackUrl = `${callbackBase}/mobile-payments/callback/${
      provider === 'freemopay' ? 'freemopay' : 'mypvit'
    }`;
    const tx = await this.mobilePaymentsDatabaseService.createTransaction({
      reference,
      amount: VERIFICATION_AMOUNT,
      currency: XAF,
      description: `Phone verification ${phone.phone_e164}`,
      provider,
      payment_method: 'mobile_money',
      customer_phone: phone.phone_e164,
      account_id: hqAccount.id,
      transaction_type: 'PAYMENT',
      payment_entity: 'phone_verification',
      entity_id: phoneId,
    });
    const paymentResponse = await this.mobilePaymentsService.initiatePayment(
      {
        amount: VERIFICATION_AMOUNT,
        currency: XAF,
        description: `Verify ${phone.phone_e164}`,
        customerPhone: phone.phone_e164,
        provider,
        ownerCharge: 'MERCHANT',
        transactionType: 'PAYMENT',
        callbackUrl,
      },
      reference
    );
    if (paymentResponse.success && paymentResponse.transactionId) {
      await this.mobilePaymentsDatabaseService.updateTransaction(tx.id, {
        transaction_id: paymentResponse.transactionId,
      });
    } else {
      await this.mobilePaymentsDatabaseService.updateTransaction(tx.id, {
        status: 'failed',
        error_message: paymentResponse.message,
        error_code: paymentResponse.errorCode,
      });
      throw new BadRequestException(
        paymentResponse.message || 'Failed to initiate verification payment'
      );
    }
    await this.hasuraSystemService.executeMutation(
      `mutation LinkTx($id: uuid!, $txId: uuid!) {
        update_user_mobile_payment_phones_by_pk(
          pk_columns: { id: $id }
          _set: { last_verification_transaction_id: $txId }
        ) { id }
      }`,
      { id: phoneId, txId: tx.id }
    );
    return {
      transactionId: tx.id,
      providerTransactionId: paymentResponse.transactionId,
      provider: paymentResponse.provider ?? provider,
      message: paymentResponse.message,
    };
  }

  async getVerificationStatus(
    userId: string,
    phoneId: string
  ): Promise<MobilePaymentPhoneVerificationStatus> {
    const phone = await this.getByIdForUser(userId, phoneId);
    let pendingTransaction = null;
    if (phone.last_verification_transaction_id) {
      const tx = await this.mobilePaymentsDatabaseService.getTransactionById(
        phone.last_verification_transaction_id
      );
      if (tx) {
        pendingTransaction = {
          id: tx.id,
          status: tx.status,
          reference: tx.reference,
        };
      }
    }
    return { phone, pendingTransaction };
  }

  async attachAgentPhone(userId: string, phoneId: string): Promise<void> {
    const phone = await this.getByIdForUser(userId, phoneId);
    await this.hasuraSystemService.executeMutation(
      `mutation AttachAgent($userId: uuid!, $phoneId: uuid!) {
        update_agents(
          where: { user_id: { _eq: $userId } }
          _set: { mobile_payment_phone_id: $phoneId }
        ) { affected_rows }
      }`,
      { userId, phoneId }
    );
    if (phone.is_verified) {
      await this.maybeVerifyAgent(userId);
    } else {
      await this.maybeUnverifyAgent(userId);
    }
  }

  async hasVerifiedPhoneForUser(userId: string): Promise<boolean> {
    const res = await this.hasuraSystemService.executeQuery(
      `query HasVerified($userId: uuid!) {
        user_mobile_payment_phones(
          where: { user_id: { _eq: $userId }, is_verified: { _eq: true } }
          limit: 1
        ) { id }
      }`,
      { userId }
    );
    return (res.user_mobile_payment_phones?.length ?? 0) > 0;
  }

  async getBusinessPhoneVerificationStep(userId: string, businessId: string) {
    const res = await this.hasuraSystemService.executeQuery(
      `query LocPhones($businessId: uuid!) {
        business_locations(
          where: { business_id: { _eq: $businessId }, is_active: { _eq: true } }
        ) {
          id
          mobile_payment_phone_id
          mobile_payment_phone { is_verified }
        }
      }`,
      { businessId }
    );
    const locations = res.business_locations ?? [];
    const verifiedCount = locations.filter(
      (l: any) => l.mobile_payment_phone?.is_verified === true
    ).length;
    const needing = locations.filter(
      (l: any) => !l.mobile_payment_phone?.is_verified
    ).length;
    return {
      complete: locations.length > 0 && verifiedCount > 0,
      hasVerifiedPhone: verifiedCount > 0,
      locationCountNeedingPhone: needing,
      totalActiveLocations: locations.length,
    };
  }

  async completeVerificationFromTransaction(
    phoneId: string,
    paymentTransactionId: string
  ): Promise<void> {
    const phone = await this.fetchPhoneById(phoneId);
    if (!phone) {
      this.logger.warn(`Phone verification tx for missing phone ${phoneId}`);
      return;
    }
    if (
      !phone.last_verification_transaction_id ||
      phone.last_verification_transaction_id !== paymentTransactionId
    ) {
      this.logger.warn(
        `Stale phone verification callback for ${phoneId}: tx ${paymentTransactionId} is not current pending verification`
      );
      await this.refundSupersededVerificationIfSuccessful(
        phone,
        paymentTransactionId
      );
      return;
    }
    const tx =
      await this.mobilePaymentsDatabaseService.getTransactionById(
        paymentTransactionId
      );
    if (!tx || tx.payment_entity !== 'phone_verification') {
      this.logger.warn(
        `Phone verification callback tx ${paymentTransactionId} missing or wrong entity`
      );
      return;
    }
    if (
      tx.customer_phone?.trim() &&
      tx.customer_phone.trim() !== phone.phone_e164
    ) {
      this.logger.warn(
        `Phone verification callback tx ${paymentTransactionId} customer_phone does not match registry ${phone.phone_e164}`
      );
      return;
    }
    if (phone.is_verified) {
      await this.refundVerificationIfNeeded(phone);
      return;
    }
    await this.markVerified(phoneId, phone.last_verification_transaction_id);
    await this.refundVerificationIfNeeded({
      ...phone,
      is_verified: true,
    });
    await this.activateAfterVerification(phone.user_id);
  }

  private async activateAfterVerification(userId: string): Promise<void> {
    const businessId =
      await this.merchantLifecycleService.getBusinessIdForUser(userId);
    if (businessId) {
      // Business account verification is ID-based; phone verify only gates catalog per location.
      return;
    }
    await this.maybeVerifyAgent(userId);
  }

  async onVerificationLost(userId: string): Promise<void> {
    const businessId =
      await this.merchantLifecycleService.getBusinessIdForUser(userId);
    if (businessId) {
      return;
    }
    await this.maybeUnverifyAgent(userId);
  }

  private async maybeVerifyAgent(userId: string): Promise<void> {
    const approved = await this.userHasApprovedId(userId);
    if (!approved) return;
    const hasVerified = await this.agentHasVerifiedPhone(userId);
    if (!hasVerified) return;
    await this.hasuraSystemService.executeMutation(
      `mutation VerifyAgent($userId: uuid!) {
        update_agents(
          where: { user_id: { _eq: $userId } }
          _set: { is_verified: true }
        ) { affected_rows }
      }`,
      { userId }
    );
  }

  private async maybeUnverifyAgent(userId: string): Promise<void> {
    const rail = await this.paymentRoutingService.resolveRailForUser(userId);
    if (rail === 'stripe') return;
    const hasVerified = await this.agentHasVerifiedPhone(userId);
    if (hasVerified) return;
    await this.hasuraSystemService.executeMutation(
      `mutation UnverifyAgent($userId: uuid!) {
        update_agents(
          where: { user_id: { _eq: $userId } }
          _set: { is_verified: false }
        ) { affected_rows }
      }`,
      { userId }
    );
  }

  private isRecentVerificationPendingTx(
    tx: MobilePaymentTransaction
  ): boolean {
    const ageMs = Date.now() - new Date(tx.created_at).getTime();
    return ageMs >= 0 && ageMs < VERIFICATION_PENDING_REUSE_MS;
  }

  private async refundVerificationIfNeeded(
    phone: UserMobilePaymentPhoneRow
  ): Promise<void> {
    const txId = phone.last_verification_transaction_id;
    if (!txId) return;
    await this.refundVerificationTransaction(phone.phone_e164, txId);
  }

  private async refundSupersededVerificationIfSuccessful(
    phone: UserMobilePaymentPhoneRow,
    paymentTransactionId: string
  ): Promise<void> {
    const tx =
      await this.mobilePaymentsDatabaseService.getTransactionById(
        paymentTransactionId
      );
    if (
      !tx ||
      tx.payment_entity !== 'phone_verification' ||
      tx.status !== 'success'
    ) {
      return;
    }
    if (
      tx.customer_phone?.trim() &&
      tx.customer_phone.trim() !== phone.phone_e164
    ) {
      return;
    }
    await this.refundVerificationTransaction(phone.phone_e164, paymentTransactionId);
  }

  private async refundVerificationTransaction(
    phoneE164: string,
    verificationTxId: string
  ): Promise<void> {
    const existingRefund = await this.findRefundForVerification(
      verificationTxId,
      phoneE164
    );
    if (existingRefund) return;
    const hqAccount = await this.resolveHqAccount();
    await this.giveChangePayoutService.executeGiveChangePayout(
      {
        amount: VERIFICATION_AMOUNT,
        currency: XAF,
        description: `Phone verification refund ${phoneE164}`,
        customerPhone: phoneE164,
        accountId: hqAccount.id,
        provider: this.mobilePaymentsService.getProvider(phoneE164) as
          | 'mypvit'
          | 'freemopay',
        entityId: verificationTxId,
      },
      { throwOnWithdrawalFailure: false }
    );
  }

  private async findRefundForVerification(
    verificationTxId: string,
    phoneE164: string
  ): Promise<boolean> {
    const res = await this.hasuraSystemService.executeQuery(
      `query RefundTx($entityId: uuid!, $desc: String!) {
        mobile_payment_transactions(
          where: {
            transaction_type: { _eq: GIVE_CHANGE }
            entity_id: { _eq: $entityId }
            description: { _eq: $desc }
            status: { _in: [success, pending] }
          }
          limit: 1
        ) { id }
      }`,
      {
        entityId: verificationTxId,
        desc: `Phone verification refund ${phoneE164}`,
      }
    );
    return (res.mobile_payment_transactions?.length ?? 0) > 0;
  }

  private async markVerified(
    phoneId: string,
    txId: string | null
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation MarkVerified($id: uuid!, $txId: uuid, $at: timestamptz!) {
        update_user_mobile_payment_phones_by_pk(
          pk_columns: { id: $id }
          _set: {
            is_verified: true
            verified_at: $at
            last_verification_transaction_id: $txId
          }
        ) { id }
      }`,
      { id: phoneId, txId, at: new Date().toISOString() }
    );
    await this.syncLocationPhonesFromRegistry(phoneId);
  }

  private async syncLocationPhonesFromRegistry(
    phoneId: string,
    phoneE164?: string
  ): Promise<void> {
    let e164 = phoneE164;
    if (!e164) {
      const row = await this.fetchPhoneById(phoneId);
      e164 = row?.phone_e164;
    }
    if (!e164) return;
    await this.hasuraSystemService.executeMutation(
      `mutation SyncLocPhone($phoneId: uuid!, $phone: String!) {
        update_business_locations(
          where: { mobile_payment_phone_id: { _eq: $phoneId } }
          _set: { phone: $phone }
        ) { affected_rows }
      }`,
      { phoneId, phone: e164 }
    );
  }

  private async agentHasVerifiedPhone(userId: string): Promise<boolean> {
    const res = await this.hasuraSystemService.executeQuery(
      `query AgentPhone($userId: uuid!) {
        agents(where: { user_id: { _eq: $userId } }, limit: 1) {
          mobile_payment_phone { is_verified }
        }
      }`,
      { userId }
    );
    return res.agents?.[0]?.mobile_payment_phone?.is_verified === true;
  }

  private async userHasApprovedId(userId: string): Promise<boolean> {
    const res = await this.hasuraSystemService.executeQuery(
      `query IdApproved($userId: uuid!, $names: [String!]) {
        user_uploads(
          where: {
            user_id: { _eq: $userId }
            is_approved: { _eq: true }
            document_type: { name: { _in: $names } }
          }
          limit: 1
        ) { id }
      }`,
      { userId, names: ID_DOC_NAMES }
    );
    return (res.user_uploads?.length ?? 0) > 0;
  }

  private async countReferences(phoneId: string): Promise<number> {
    const res = await this.hasuraSystemService.executeQuery(
      `query Refs($phoneId: uuid!) {
        business_locations_aggregate(
          where: { mobile_payment_phone_id: { _eq: $phoneId } }
        ) { aggregate { count } }
        agents_aggregate(
          where: { mobile_payment_phone_id: { _eq: $phoneId } }
        ) { aggregate { count } }
      }`,
      { phoneId }
    );
    const loc = res.business_locations_aggregate?.aggregate?.count ?? 0;
    const ag = res.agents_aggregate?.aggregate?.count ?? 0;
    return loc + ag;
  }

  private async fetchPhoneForUser(
    userId: string,
    phoneId: string
  ): Promise<UserMobilePaymentPhoneRow | null> {
    const res = await this.hasuraSystemService.executeQuery(
      `query Phone($id: uuid!, $userId: uuid!) {
        user_mobile_payment_phones(
          where: { id: { _eq: $id }, user_id: { _eq: $userId } }
          limit: 1
        ) {
          id user_id phone_e164 is_verified verified_at
          last_verification_transaction_id created_at updated_at
        }
      }`,
      { id: phoneId, userId }
    );
    return res.user_mobile_payment_phones?.[0] ?? null;
  }

  private async fetchPhoneById(
    phoneId: string
  ): Promise<UserMobilePaymentPhoneRow | null> {
    const res = await this.hasuraSystemService.executeQuery(
      `query PhoneById($id: uuid!) {
        user_mobile_payment_phones_by_pk(id: $id) {
          id user_id phone_e164 is_verified verified_at
          last_verification_transaction_id created_at updated_at
        }
      }`,
      { id: phoneId }
    );
    return res.user_mobile_payment_phones_by_pk ?? null;
  }

  private async findByUserAndE164(
    userId: string,
    phoneE164: string
  ): Promise<UserMobilePaymentPhoneRow | null> {
    const res = await this.hasuraSystemService.executeQuery(
      `query FindPhone($userId: uuid!, $phone: String!) {
        user_mobile_payment_phones(
          where: { user_id: { _eq: $userId }, phone_e164: { _eq: $phone } }
          limit: 1
        ) {
          id user_id phone_e164 is_verified verified_at
          last_verification_transaction_id created_at updated_at
        }
      }`,
      { userId, phone: phoneE164 }
    );
    return res.user_mobile_payment_phones?.[0] ?? null;
  }

  private requireE164(countryCode: string, phoneNumber: string): string {
    const e164 = normalizeToE164(countryCode, phoneNumber);
    if (!e164 || !isSupportedMobileMoneyE164(e164)) {
      throw new BadRequestException(
        'Unsupported phone number. Mobile money verification is available for Cameroon (+237) and Gabon (+241).'
      );
    }
    return e164;
  }

  private assertProviderSupports(phoneE164: string): void {
    try {
      this.mobilePaymentsService.getProvider(phoneE164);
    } catch {
      throw new BadRequestException('Phone prefix is not supported for mobile money');
    }
  }

  private async assertMobileMoneyRail(userId: string): Promise<void> {
    const rail = await this.paymentRoutingService.resolveRailForUser(userId);
    if (rail !== 'mobile_money') {
      throw new BadRequestException(
        'Mobile payment phone verification is not required for your payment region'
      );
    }
  }

  private async resolveHqAccount() {
    const hqUser = await this.hasuraSystemService.getRendasuaHQUser();
    if (!hqUser) throw new BadRequestException('HQ account not configured');
    return this.hasuraSystemService.getAccount(hqUser.id, XAF);
  }

  private generateReference(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4);
    return `PHV${timestamp}${random}`;
  }
}
