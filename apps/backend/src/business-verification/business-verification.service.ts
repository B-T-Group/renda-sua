import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import Mustache from 'mustache';
import * as path from 'path';
import {
  MERCHANT_AGREEMENT_TEMPLATE,
  MERCHANT_AGREEMENT_VERSION,
} from '../agreements/merchant-agreement.constants';
import { AwsService } from '../aws/aws.service';
import { BusinessContractsService } from '../business-contracts/business-contracts.service';
import { MerchantAgreementProviderService } from '../business-contracts/merchant-agreement-provider.service';
import { getCommissionMapForCountry } from '../commissions/business-account-type';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { StripeConnectService } from '../stripe-payments/stripe-connect.service';
import { LaunchPromoService } from '../launch-promo/launch-promo.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { MobilePaymentPhonesService } from '../mobile-payment-phones/mobile-payment-phones.service';
import { AcceptMerchantAgreementDto } from './dto/accept-merchant-agreement.dto';
import { parseIdRejectionReason } from '../services/upload.service';

export type VerificationNextAction =
  | 'sign_agreement'
  | 'upload_id'
  | 'setup_stripe_connect'
  | 'publish_catalog'
  | 'pending_review'
  | 'verify_mobile_payment_phone'
  | 'complete';

const MERCHANT_ACTION_NEXT_ACTIONS: ReadonlySet<VerificationNextAction> = new Set([
  'sign_agreement',
  'setup_stripe_connect',
] as const);

const ID_DOC_NAMES = ['id_card', 'passport', 'driver_license'];
const USER_UPLOADS_BUCKET = 'rendasua-user-uploads';

type AcceptanceRow = {
  id: string;
  accepted_at: string;
  pdf_upload_id?: string | null;
  signature_image_key?: string | null;
};

@Injectable()
export class BusinessVerificationService {
  private readonly logger = new Logger(BusinessVerificationService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly pdfService: PdfService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly merchantLifecycleService: MerchantLifecycleService,
    private readonly businessContractsService: BusinessContractsService,
    private readonly mobilePaymentPhonesService: MobilePaymentPhonesService,
    private readonly agreementProvider: MerchantAgreementProviderService,
    private readonly launchPromoService: LaunchPromoService,
    private readonly awsService: AwsService
  ) {}

  async getStatus() {
    const user = await this.requireBusinessUser();
    const businessId = user.business!.id;
    // Keep lifecycle in sync when dashboard/status is opened (e.g. after
    // item approval paths that missed an explicit recompute).
    await this.merchantLifecycleService.recompute(
      businessId,
      'verification_status'
    );
    const base = await this.buildStatus(businessId, user);
    const lifecycle = await this.merchantLifecycleService.getBusinessSnapshot(
      businessId
    );
    const suspension =
      lifecycle?.lifecycle_status === 'suspended'
        ? await this.merchantLifecycleService.getLatestSuspension(businessId)
        : null;
    const lifecycleStatus = lifecycle?.lifecycle_status ?? 'created';
    const canAcceptOrders = lifecycle?.can_accept_orders ?? false;
    const storefrontVisible = lifecycle?.is_storefront_visible ?? false;
    const isVerified = lifecycle?.is_verified ?? false;
    const launchPromo = await this.launchPromoService.getSlotForBusiness(
      businessId
    );
    return {
      ...base,
      is_verified: isVerified,
      lifecycle_status: lifecycleStatus,
      is_storefront_visible: storefrontVisible,
      can_accept_orders: canAcceptOrders,
      isOnboarding: this.resolveIsOnboarding(lifecycleStatus, base),
      suspension,
      contract: await this.businessContractsService.getContractStatus(businessId),
      launchPromo: launchPromo
        ? {
            status: launchPromo.status,
            ordersRemaining: launchPromo.ordersRemaining,
            businessLimit: launchPromo.businessLimit,
            zeroCommissionOrders: launchPromo.zeroCommissionOrders,
            identificationWindowDays: launchPromo.identificationWindowDays,
            claimedAt: launchPromo.claimedAt,
            confirmedAt: launchPromo.confirmedAt,
          }
        : null,
    };
  }

  async getMerchantAgreementForUser() {
    const user = await this.requireBusinessUser();
    const lang = user.preferred_language?.startsWith('fr') ? 'fr' : 'en';
    const countryCode = await this.agreementProvider.getBusinessCountryCode(
      user.business!.id
    );
    const commissionMap = getCommissionMapForCountry(countryCode);
    const html = this.renderAgreementTemplate(lang, {
      businessName: user.business?.name ?? '',
      signerLegalName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      signerEmail: user.email ?? '',
      acceptedAt:
        lang === 'fr' ? 'À la signature électronique' : 'Upon electronic acceptance',
      agreementVersion: MERCHANT_AGREEMENT_VERSION,
      standardCommission: commissionMap.STANDARD,
      premiumCommission: commissionMap.PREMIUM,
      eliteCommission: commissionMap.ELITE,
    });
    return {
      version: MERCHANT_AGREEMENT_VERSION,
      locale: lang,
      html,
    };
  }

  async acceptAgreement(
    dto: AcceptMerchantAgreementDto,
    ipAddress: string | undefined,
    userAgent: string | undefined
  ) {
    const user = await this.requireBusinessUser();
    const business = user.business!;
    await this.assertCanAcceptInApp(dto, business);
    const countryCode = await this.agreementProvider.getBusinessCountryCode(
      business.id
    );
    const legalName = dto.legalName.trim();
    const acceptedAt = new Date().toISOString();
    const signatureImageKey = await this.storeSignatureImage(
      user.id,
      business.id,
      dto.signatureBase64
    );
    const acceptance = await this.insertAcceptance({
      businessId: business.id,
      dto,
      legalName,
      user,
      ipAddress,
      userAgent,
      pdfUploadId: null,
      signatureImageKey,
      acceptedAt,
      countryCode,
    });
    await this.merchantLifecycleService.recompute(
      business.id,
      'merchant_agreement_accepted'
    );
    const pdfUploadId = await this.finishAcceptPdfAndEmail({
      acceptanceId: acceptance.id,
      businessId: business.id,
      locale: user.preferred_language ?? 'en',
      businessName: business.name,
      signerLegalName: legalName,
      signerEmail: user.email ?? '',
      acceptedAt,
      signatureBase64: dto.signatureBase64,
      countryCode,
    });
    return {
      acceptance,
      pdfUploadId,
      pdfGenerated: Boolean(pdfUploadId),
    };
  }

  async retryMerchantAgreementPdf(acceptanceId: string) {
    const user = await this.requireBusinessUser();
    const row = await this.requireOwnedAcceptance(
      acceptanceId,
      user.business!.id
    );
    return this.generatePdfForAcceptanceRow(
      row,
      user.preferred_language ?? 'en'
    );
  }

  async retryMerchantAgreementPdfAsAdmin(businessId: string) {
    const row = await this.requireLatestAcceptance(businessId);
    const owner = await this.resolveBusinessOwner(businessId);
    return this.generatePdfForAcceptanceRow(
      row,
      owner.locale,
      owner.userId
    );
  }

  private async resolveBusinessOwner(businessId: string): Promise<{
    userId: string;
    locale: string;
  }> {
    const result = await this.hasuraSystemService.executeQuery<{
      businesses_by_pk: {
        user: { id: string; preferred_language: string | null };
      } | null;
    }>(
      `query OwnerLocale($id: uuid!) {
        businesses_by_pk(id: $id) {
          user { id preferred_language }
        }
      }`,
      { id: businessId }
    );
    const user = result.businesses_by_pk?.user;
    if (!user?.id) {
      throw new NotFoundException('Business owner not found');
    }
    return {
      userId: user.id,
      locale: user.preferred_language ?? 'en',
    };
  }

  private async finishAcceptPdfAndEmail(params: {
    acceptanceId: string;
    businessId: string;
    locale: string;
    businessName: string;
    signerLegalName: string;
    signerEmail: string;
    acceptedAt: string;
    signatureBase64?: string;
    countryCode: string | null;
  }): Promise<string | null> {
    const result = await this.safeTryGenerateAgreementPdf(params);
    const pdfUploadId = result?.uploadId ?? null;
    try {
      await this.notificationsService.sendMerchantAgreementCopyEmail({
        to: params.signerEmail,
        businessName: params.businessName,
        signerLegalName: params.signerLegalName,
        agreementVersion: MERCHANT_AGREEMENT_VERSION,
        pdfGenerated: Boolean(pdfUploadId),
      });
    } catch (error: any) {
      this.logger.error(
        `Merchant agreement email failed after accept for business ${params.businessId}: ${error?.message || error}`
      );
    }
    return pdfUploadId;
  }

  private async safeTryGenerateAgreementPdf(params: {
    acceptanceId: string;
    businessId: string;
    locale: string;
    businessName: string;
    signerLegalName: string;
    signerEmail: string;
    acceptedAt: string;
    signatureBase64?: string;
    countryCode: string | null;
    agreementVersion?: string;
  }): Promise<{ uploadId: string; linked: boolean } | null> {
    try {
      return await this.tryGenerateAgreementPdf(params);
    } catch (error: any) {
      this.logger.error(
        `Merchant agreement PDF escaped tryGenerate for business ${params.businessId} acceptance ${params.acceptanceId}: ${error?.message || error}`
      );
      return null;
    }
  }

  private async generatePdfForAcceptanceRow(
    row: {
      id: string;
      accepted_at: string;
      pdf_upload_id: string | null;
      signature_image_key: string | null;
      business_id: string;
      business_name: string;
      signer_legal_name: string;
      signer_email: string;
      country_code: string | null;
      agreement_version: string;
    },
    locale: string,
    ownerUserId?: string
  ) {
    if (row.pdf_upload_id) {
      return { pdfUploadId: row.pdf_upload_id, pdfGenerated: true };
    }
    const signatureBase64 = await this.resolveRetrySignature(
      row.signature_image_key
    );
    const result = await this.tryGenerateAgreementPdf({
      acceptanceId: row.id,
      businessId: row.business_id,
      locale,
      businessName: row.business_name,
      signerLegalName: row.signer_legal_name,
      signerEmail: row.signer_email,
      acceptedAt: row.accepted_at,
      signatureBase64,
      countryCode: row.country_code,
      agreementVersion: row.agreement_version,
      ownerUserId,
    });
    if (!result?.uploadId) {
      throw new BadRequestException(
        'Could not generate agreement PDF. Please try again later.'
      );
    }
    if (!result.linked) {
      await this.setAcceptancePdfUploadId(row.id, result.uploadId);
    }
    return { pdfUploadId: result.uploadId, pdfGenerated: true };
  }

  private async resolveRetrySignature(
    signatureImageKey: string | null
  ): Promise<string | undefined> {
    if (!signatureImageKey) return undefined;
    const signatureBase64 = await this.loadSignatureBase64(signatureImageKey);
    if (!signatureBase64) {
      throw new BadRequestException(
        'Stored signature could not be loaded for PDF retry'
      );
    }
    return signatureBase64;
  }

  private async assertCanAcceptInApp(
    dto: AcceptMerchantAgreementDto,
    business: { id: string; merchant_agreement_version?: string | null }
  ): Promise<void> {
    const boldSignForBusiness =
      await this.businessContractsService.isBoldSignEnabledForBusiness(
        business.id
      );
    if (boldSignForBusiness) {
      throw new BadRequestException(
        'Agreement must be signed via email. Check your inbox for the BoldSign request.'
      );
    }
    if (dto.agreementVersion !== MERCHANT_AGREEMENT_VERSION) {
      throw new BadRequestException(
        'Agreement version is outdated. Please refresh and try again.'
      );
    }
    if (business.merchant_agreement_version === MERCHANT_AGREEMENT_VERSION) {
      throw new BadRequestException('This agreement version is already accepted.');
    }
  }

  private async requireBusinessUser() {
    const user = await this.hasuraUserService.getUser();
    if (!user?.business?.id) {
      throw new ForbiddenException('User has no business');
    }
    return user;
  }

  private loadAgreementTemplate(lang: 'en' | 'fr'): string {
    const file = path.join(
      __dirname,
      '..',
      'agreements',
      `${MERCHANT_AGREEMENT_TEMPLATE}.${lang}.html`
    );
    return fs.readFileSync(file, 'utf8');
  }

  private renderAgreementTemplate(
    lang: 'en' | 'fr',
    data: {
      businessName: string;
      signerLegalName: string;
      signerEmail: string;
      acceptedAt: string;
      agreementVersion: string;
      signatureImageUrl?: string;
      standardCommission: number;
      premiumCommission: number;
      eliteCommission: number;
    }
  ): string {
    const template = this.loadAgreementTemplate(lang);
    return Mustache.render(template, data);
  }

  private async buildStatus(businessId: string, user: any) {
    const agreement = await this.getAgreementStep(businessId, user.business);
    const rail = await this.paymentRoutingService.resolveRailForUser(user.id);
    if (rail === 'stripe') {
      return this.buildStripeStatus(user, agreement);
    }
    return this.buildMobileMoneyStatus(user, agreement);
  }

  private async buildMobileMoneyStatus(
    user: any,
    agreement: { complete: boolean }
  ) {
    const identity = await this.getIdentityStep(user.id);
    const [mobilePaymentPhone, catalog] = await Promise.all([
      this.mobilePaymentPhonesService.getBusinessPhoneVerificationStep(
        user.id,
        user.business!.id
      ),
      this.merchantLifecycleService.getCatalogStep(user.business!.id),
    ]);
    const nextAction = this.resolveNextAction(agreement);
    return {
      // Overwritten in getStatus from lifecycle snapshot (DB is_verified).
      is_verified: false,
      accountFullName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      steps: { agreement, identity, mobilePaymentPhone, catalog },
      nextAction,
      requiresMerchantAction: this.requiresMerchantAction(nextAction),
      paymentRail: 'mobile_money' as const,
    };
  }

  private async buildStripeStatus(
    user: any,
    agreement: { complete: boolean }
  ) {
    const stripeConnect = await this.getStripeConnectStep(user.id);
    const nextAction = this.resolveStripeNextAction(agreement, stripeConnect);
    return {
      // Overwritten in getStatus from lifecycle snapshot (DB is_verified).
      is_verified: false,
      accountFullName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      steps: { agreement, stripeConnect },
      nextAction,
      requiresMerchantAction: this.requiresMerchantAction(nextAction),
      paymentRail: 'stripe' as const,
    };
  }

  private requiresMerchantAction(nextAction: VerificationNextAction): boolean {
    return MERCHANT_ACTION_NEXT_ACTIONS.has(nextAction);
  }

  private async getStripeConnectStep(userId: string) {
    const account = await this.stripeConnectService.getByUserId(userId);
    const complete =
      !!account && account.charges_enabled && account.payouts_enabled;
    return {
      complete,
      status: account?.status ?? 'not_started',
      connected: !!account,
    };
  }

  private resolveStripeNextAction(
    agreement: { complete: boolean },
    stripeConnect: { complete: boolean }
  ): VerificationNextAction {
    if (!agreement.complete) return 'sign_agreement';
    if (!stripeConnect.complete) return 'setup_stripe_connect';
    return 'complete';
  }

  private async getAgreementStep(businessId: string, business: any) {
    const contract = await this.businessContractsService.getContractStatus(
      businessId
    );
    // Already-signed BoldSign rows still count after a country switches to in-app.
    if (contract.complete) {
      return {
        complete: true,
        version: contract.version ?? business?.merchant_agreement_version ?? null,
        acceptedAt:
          contract.acceptedAt ?? business?.merchant_agreement_accepted_at ?? null,
        status: contract.status,
        contractId: contract.contractId,
      };
    }
    if (contract.boldSignEnabled) {
      return {
        complete: false,
        version: contract.version,
        acceptedAt: contract.acceptedAt,
        status: contract.status,
        contractId: contract.contractId,
      };
    }
    // In-app path: any recorded acceptance counts (avoid re-forcing on version bumps).
    const version = business?.merchant_agreement_version ?? null;
    const acceptedAt = business?.merchant_agreement_accepted_at ?? null;
    const complete = !!version && !!acceptedAt;
    return { complete, version, acceptedAt };
  }

  private async getIdentityStep(userId: string) {
    const rows = await this.hasuraUserService.executeQuery<{
      user_uploads: Array<{
        id: string;
        is_approved: boolean;
        note: string | null;
        document_type: { name: string };
      }>;
    }>(
      `query IdDocs($userId: uuid!, $names: [String!]) {
        user_uploads(
          where: {
            user_id: { _eq: $userId }
            document_type: { name: { _in: $names } }
          }
          order_by: { created_at: desc }
        ) {
          id
          is_approved
          note
          document_type { name }
        }
      }`,
      { userId, names: ID_DOC_NAMES }
    );
    const uploads = rows.user_uploads ?? [];
    if (!uploads.length) {
      return {
        complete: false,
        status: 'missing' as const,
        uploadId: null,
        rejectionReason: null,
      };
    }
    const approved = uploads.find((u) => u.is_approved);
    if (approved) {
      return {
        complete: true,
        status: 'approved' as const,
        uploadId: approved.id,
        rejectionReason: null,
      };
    }
    const latest = uploads[0];
    // Admin rejections store note as `[REJECTED] …` (see formatIdRejectionNote).
    const rejectionReason = parseIdRejectionReason(latest?.note);
    if (rejectionReason) {
      return {
        complete: false,
        status: 'rejected' as const,
        uploadId: latest.id,
        rejectionReason,
      };
    }
    return {
      complete: true,
      status: 'pending' as const,
      uploadId: latest.id,
      rejectionReason: null,
    };
  }

  private resolveNextAction(agreement: {
    complete: boolean;
  }): VerificationNextAction {
    if (!agreement.complete) return 'sign_agreement';
    return 'complete';
  }

  /** Focused setup until the merchant agreement is signed. */
  private resolveIsOnboarding(
    lifecycleStatus: string,
    base: {
      steps?: {
        agreement?: { complete?: boolean };
      };
    }
  ): boolean {
    if (lifecycleStatus === 'active' || lifecycleStatus === 'suspended') {
      return false;
    }
    return base.steps?.agreement?.complete !== true;
  }

  private async insertAcceptance(params: {
    businessId: string;
    dto: AcceptMerchantAgreementDto;
    legalName: string;
    user: any;
    ipAddress?: string;
    userAgent?: string;
    pdfUploadId: string | null;
    signatureImageKey: string | null;
    acceptedAt: string;
    countryCode: string | null;
  }) {
    const mutation = `
      mutation InsertAcceptance($row: business_merchant_agreement_acceptances_insert_input!) {
        insert_business_merchant_agreement_acceptances_one(object: $row) {
          id
          accepted_at
        }
      }
    `;
    const row = {
      business_id: params.businessId,
      user_id: params.user.id ?? null,
      agreement_version: MERCHANT_AGREEMENT_VERSION,
      signer_legal_name: params.legalName,
      signer_email: params.user.email ?? '',
      business_name: params.user.business.name,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      country_code: params.countryCode,
      device_info: params.dto.deviceInfo ?? null,
      pdf_upload_id: params.pdfUploadId,
      signature_image_key: params.signatureImageKey,
      accepted_at: params.acceptedAt,
    };
    const res = await this.hasuraSystemService.executeMutation(mutation, { row });
    await this.hasuraSystemService.executeMutation(
      `mutation UpdBiz($id: uuid!, $v: String!, $at: timestamptz!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: { merchant_agreement_version: $v, merchant_agreement_accepted_at: $at }
        ) { id }
      }`,
      {
        id: params.businessId,
        v: MERCHANT_AGREEMENT_VERSION,
        at: params.acceptedAt,
      }
    );
    return res.insert_business_merchant_agreement_acceptances_one as AcceptanceRow;
  }

  private async tryGenerateAgreementPdf(params: {
    acceptanceId: string;
    businessId: string;
    locale: string;
    businessName: string;
    signerLegalName: string;
    signerEmail: string;
    acceptedAt: string;
    signatureBase64?: string;
    countryCode: string | null;
    agreementVersion?: string;
    ownerUserId?: string;
  }): Promise<{ uploadId: string; linked: boolean } | null> {
    let uploadId: string;
    try {
      const pdfUpload = await this.pdfService.generateMerchantAgreementPdf({
        locale: params.locale,
        businessName: params.businessName,
        signerLegalName: params.signerLegalName,
        signerEmail: params.signerEmail,
        agreementVersion: params.agreementVersion || MERCHANT_AGREEMENT_VERSION,
        acceptedAt: params.acceptedAt,
        signatureBase64: params.signatureBase64,
        countryCode: params.countryCode,
        ownerUserId: params.ownerUserId,
      });
      uploadId = pdfUpload.id;
    } catch (error: any) {
      this.logger.error(
        `Merchant agreement PDF failed for business ${params.businessId} acceptance ${params.acceptanceId}: ${error?.message || error}`
      );
      return null;
    }
    const linked = await this.linkAcceptancePdfUploadId(
      params.acceptanceId,
      params.businessId,
      uploadId
    );
    return { uploadId, linked };
  }

  private async linkAcceptancePdfUploadId(
    acceptanceId: string,
    businessId: string,
    pdfUploadId: string
  ): Promise<boolean> {
    try {
      await this.setAcceptancePdfUploadId(acceptanceId, pdfUploadId);
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to link PDF ${pdfUploadId} to acceptance ${acceptanceId} (business ${businessId}): ${error?.message || error}`
      );
      return false;
    }
  }

  private async setAcceptancePdfUploadId(
    acceptanceId: string,
    pdfUploadId: string
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation SetPdf($id: uuid!, $pdfId: uuid!) {
        update_business_merchant_agreement_acceptances_by_pk(
          pk_columns: { id: $id }
          _set: { pdf_upload_id: $pdfId }
        ) { id }
      }`,
      { id: acceptanceId, pdfId: pdfUploadId }
    );
  }

  private async storeSignatureImage(
    userId: string,
    businessId: string,
    signatureBase64?: string
  ): Promise<string | null> {
    const raw = signatureBase64?.trim();
    if (!raw) return null;
    try {
      const buffer = this.decodeSignatureBuffer(raw);
      const key = `business/${userId}/merchant-agreement-signature/${businessId}-${Date.now()}.png`;
      await this.awsService.getS3Client().send(
        new PutObjectCommand({
          Bucket: USER_UPLOADS_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: 'image/png',
        })
      );
      return key;
    } catch (error: any) {
      this.logger.error(
        `Failed to store merchant signature image for business ${businessId}: ${error?.message || error}`
      );
      return null;
    }
  }

  private decodeSignatureBuffer(raw: string): Buffer {
    const base64 = raw.includes(',') ? raw.split(',').pop()! : raw;
    return Buffer.from(base64, 'base64');
  }

  private async loadSignatureBase64(key: string): Promise<string | null> {
    try {
      const result = await this.awsService.getS3Client().send(
        new GetObjectCommand({ Bucket: USER_UPLOADS_BUCKET, Key: key })
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes?.length) return null;
      return Buffer.from(bytes).toString('base64');
    } catch (error: any) {
      this.logger.error(
        `Failed to load merchant signature ${key}: ${error?.message || error}`
      );
      return null;
    }
  }

  private async requireOwnedAcceptance(
    acceptanceId: string,
    businessId: string
  ) {
    const row = await this.loadAcceptanceById(acceptanceId);
    if (!row || row.business_id !== businessId) {
      throw new NotFoundException('Agreement acceptance not found');
    }
    return row;
  }

  private async requireLatestAcceptance(businessId: string) {
    const result = await this.hasuraSystemService.executeQuery<{
      business_merchant_agreement_acceptances: Array<{
        id: string;
        accepted_at: string;
        pdf_upload_id: string | null;
        signature_image_key: string | null;
        business_id: string;
        business_name: string;
        signer_legal_name: string;
        signer_email: string;
        country_code: string | null;
        agreement_version: string;
      }>;
    }>(
      `query LatestAcceptance($businessId: uuid!) {
        business_merchant_agreement_acceptances(
          where: { business_id: { _eq: $businessId } }
          order_by: { accepted_at: desc }
          limit: 1
        ) {
          id accepted_at pdf_upload_id signature_image_key business_id
          business_name signer_legal_name signer_email country_code agreement_version
        }
      }`,
      { businessId }
    );
    const row = result.business_merchant_agreement_acceptances?.[0];
    if (!row) {
      throw new NotFoundException('Agreement acceptance not found');
    }
    return row;
  }

  private async loadAcceptanceById(acceptanceId: string) {
    const result = await this.hasuraSystemService.executeQuery<{
      business_merchant_agreement_acceptances_by_pk: {
        id: string;
        accepted_at: string;
        pdf_upload_id: string | null;
        signature_image_key: string | null;
        business_id: string;
        business_name: string;
        signer_legal_name: string;
        signer_email: string;
        country_code: string | null;
        agreement_version: string;
      } | null;
    }>(
      `query Acceptance($id: uuid!) {
        business_merchant_agreement_acceptances_by_pk(id: $id) {
          id accepted_at pdf_upload_id signature_image_key business_id
          business_name signer_legal_name signer_email country_code agreement_version
        }
      }`,
      { id: acceptanceId }
    );
    return result.business_merchant_agreement_acceptances_by_pk;
  }
}