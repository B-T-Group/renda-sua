import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AwsService } from '../aws/aws.service';
import type { BoldSignConfig, Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BoldsignClientService } from './boldsign-client.service';
import {
  canTransitionContractStatus,
  mapBoldSignEventToStatus,
} from './business-contract-status.util';
import { BusinessContractsDatabaseService } from './business-contracts-database.service';
import {
  BoldSignWebhookPayload,
  BusinessContractRow,
  ContractStatus,
  ContractStatusSnapshot,
} from './business-contracts.types';

@Injectable()
export class BusinessContractsService {
  private readonly logger = new Logger(BusinessContractsService.name);

  constructor(
    private readonly db: BusinessContractsDatabaseService,
    private readonly boldsign: BoldsignClientService,
    private readonly awsService: AwsService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<Configuration>,
    @Inject(forwardRef(() => MerchantLifecycleService))
    private readonly merchantLifecycleService: MerchantLifecycleService
  ) {}

  private get config(): BoldSignConfig {
    return this.configService.get<BoldSignConfig>('boldsign') as BoldSignConfig;
  }

  isBoldSignEnabled(): boolean {
    return this.config.enabled && this.boldsign.isConfigured();
  }

  async hasValidSignedContract(businessId: string): Promise<boolean> {
    if (await this.db.hasValidSignedContract(businessId)) return true;
    if (!this.isBoldSignEnabled()) {
      return this.hasLegacyAgreement(businessId);
    }
    return false;
  }

  async getContractStatus(businessId: string): Promise<ContractStatusSnapshot> {
    const latest = await this.db.getLatestContract(businessId);
    const complete = await this.hasValidSignedContract(businessId);
    return {
      complete,
      status: latest?.status ?? null,
      version: latest?.contract_version ?? null,
      acceptedAt: latest?.signed_at ?? null,
      contractId: latest?.id ?? null,
      canDownload: latest?.status === 'signed' && !!latest.signed_pdf_s3_key,
      boldSignEnabled: this.isBoldSignEnabled(),
    };
  }

  async ensureContractForBusiness(businessId: string): Promise<void> {
    if (!this.isBoldSignEnabled()) return;
    const inFlight = await this.db.getInFlightContract(businessId);
    if (inFlight) {
      await this.resumeInFlightContract(inFlight);
      return;
    }
    const latest = await this.db.getLatestContract(businessId);
    if (latest && !this.isRetryable(latest.status)) return;
    await this.createAndSendContract(businessId);
  }

  /**
   * Sync BoldSign completion into our DB (for refresh / missed webhooks),
   * then return the latest status snapshot.
   */
  async refreshContractForBusiness(
    businessId: string
  ): Promise<ContractStatusSnapshot> {
    await this.syncInFlightFromBoldsign(businessId);
    return this.getContractStatus(businessId);
  }

  async syncInFlightFromBoldsign(businessId: string): Promise<void> {
    const latest = await this.db.getLatestContract(businessId);
    if (!latest || (latest.status !== 'sent' && latest.status !== 'viewed')) {
      return;
    }
    const documentId = latest.boldsign_document_id;
    if (documentId.startsWith('legacy:') || documentId.startsWith('pending:')) {
      return;
    }
    try {
      await this.markCompletedFromBoldsign(latest, documentId);
    } catch (error: any) {
      this.logger.debug(
        `BoldSign sync skip for ${businessId}: ${error?.message}`
      );
    }
  }

  private async markCompletedFromBoldsign(
    contract: BusinessContractRow,
    documentId: string
  ): Promise<void> {
    const props = await this.boldsign.getDocumentProperties(documentId);
    const status = String((props as { status?: string }).status ?? '').toLowerCase();
    if (status !== 'completed') return;
    await this.persistSignedStatus(contract, props);
  }

  private async persistSignedStatus(
    contract: BusinessContractRow,
    props?: unknown
  ): Promise<void> {
    try {
      await this.storeSignedArtifacts(contract.id, contract.boldsign_document_id);
    } catch (error: any) {
      this.logger.warn(
        `Signed PDF store failed for ${contract.id}: ${error?.message}`
      );
    }
    await this.db.updateContract(contract.id, {
      status: 'signed',
      signed_at: contract.signed_at ?? new Date().toISOString(),
      ...(props ? { boldsign_raw_metadata: props } : {}),
    });
    await this.merchantLifecycleService.recompute(
      contract.business_id,
      'contract_signed'
    );
  }

  async resumePendingContract(row: BusinessContractRow): Promise<void> {
    if (!row.boldsign_document_id.startsWith('pending:')) return;
    if (row.status !== 'not_sent' && row.status !== 'failed') return;
    await this.sendBoldSignForRow(row);
  }

  async resendContract(businessId: string): Promise<BusinessContractRow> {
    const latest = await this.db.getLatestContract(businessId);
    if (latest && (latest.status === 'sent' || latest.status === 'viewed')) {
      if (!latest.boldsign_document_id.startsWith('legacy:')) {
        await this.boldsign.remindDocument(latest.boldsign_document_id);
      }
      return latest;
    }
    return this.createAndSendContract(businessId);
  }

  async handleWebhookEvent(
    payload: BoldSignWebhookPayload,
    signatureValid: boolean
  ): Promise<void> {
    const eventType = payload.event?.eventType ?? 'Unknown';
    const documentId = payload.data?.documentId;
    if (!documentId) return;

    const eventId = this.buildEventId(payload, documentId, eventType);
    const contract = await this.db.getContractByBoldsignId(documentId);
    const isNew = await this.db.recordEvent({
      eventId,
      eventType,
      documentId,
      contractId: contract?.id,
      payload,
      signatureValid,
    });
    if (!isNew) {
      await this.retryUnprocessedWebhookEvent(
        eventId,
        signatureValid,
        contract,
        eventType,
        payload
      );
      return;
    }
    if (!signatureValid) {
      await this.db.markEventProcessed(eventId, 'Invalid webhook secret');
      return;
    }

    try {
      await this.applyWebhookEvent(contract, eventType, payload);
      await this.db.markEventProcessed(eventId);
    } catch (error: any) {
      await this.db.markEventProcessed(eventId, error?.message);
      throw error;
    }
  }

  private async retryUnprocessedWebhookEvent(
    eventId: string,
    signatureValid: boolean,
    contract: BusinessContractRow | null,
    eventType: string,
    payload: BoldSignWebhookPayload
  ): Promise<void> {
    const existing = await this.db.getEventByEventId(eventId);
    if (!existing || existing.processed_at || !signatureValid) return;
    try {
      await this.applyWebhookEvent(contract, eventType, payload);
      await this.db.markEventProcessed(eventId);
    } catch (error: any) {
      await this.db.markEventProcessed(eventId, error?.message);
      throw error;
    }
  }

  async getDownloadUrl(
    contractId: string,
    businessId: string,
    kind: 'pdf' | 'audit'
  ): Promise<string> {
    const contract = await this.assertContractAccess(contractId, businessId);
    const key =
      kind === 'pdf'
        ? contract.signed_pdf_s3_key
        : contract.audit_certificate_s3_key;
    if (!key || contract.status !== 'signed') {
      throw new BadRequestException('Signed document not available');
    }
    const bucket = this.awsService.getDefaultBucketName();
    if (!bucket) throw new BadRequestException('Storage not configured');
    const res = await this.awsService.generatePresignedDownloadUrl({
      bucketName: bucket,
      key,
      expiresIn: 3600,
    });
    return res.url;
  }

  async invalidateContract(
    contractId: string,
    adminUserId: string,
    reason: string
  ): Promise<void> {
    await this.db.updateContract(contractId, {
      invalidated_at: new Date().toISOString(),
      invalidated_by_user_id: adminUserId,
      invalidation_reason: reason,
    });
    const contract = await this.db.getContractById(contractId);
    if (contract) {
      await this.merchantLifecycleService.recompute(
        contract.business_id,
        'contract_invalidated'
      );
    }
  }

  async listContractsForBusiness(businessId: string) {
    return this.db.listContracts(businessId);
  }

  async listEventsForContract(contractId: string) {
    return this.db.listContractEvents(contractId);
  }

  async getContractHistory(businessId: string) {
    const contracts = await this.db.listContracts(businessId);
    const latest = contracts[0];
    const events = latest
      ? await this.db.listContractEvents(latest.id)
      : [];
    return { contracts, events };
  }

  private async createAndSendContract(
    businessId: string
  ): Promise<BusinessContractRow> {
    const inFlight = await this.db.getInFlightContract(businessId);
    if (inFlight) return this.resumeInFlightContract(inFlight);

    const signer = await this.getSignerForBusiness(businessId);
    const template = await this.db.getActiveTemplate();
    if (!template) {
      throw new BadRequestException('No active contract template configured');
    }

    let contract: BusinessContractRow;
    try {
      contract = await this.db.insertContract({
        business_id: businessId,
        contract_template_id: template.id,
        contract_version: template.version,
        boldsign_document_id: `pending:${businessId}:${Date.now()}`,
        status: 'not_sent',
        signer_name: signer.name,
        signer_email: signer.email,
      });
    } catch (error: any) {
      if (this.isInFlightConflict(error)) {
        const existing = await this.db.getInFlightContract(businessId);
        if (existing) return this.resumeInFlightContract(existing);
      }
      throw error;
    }

    return this.sendBoldSignForRow(contract, template, signer);
  }

  private async sendBoldSignForRow(
    contract: BusinessContractRow,
    template?: Awaited<ReturnType<BusinessContractsDatabaseService['getActiveTemplate']>>,
    signer?: Awaited<ReturnType<BusinessContractsService['getSignerForBusiness']>>
  ): Promise<BusinessContractRow> {
    const blocked = await this.resolveInFlightConflict(contract);
    if (blocked) return blocked;

    const resolvedTemplate =
      template ?? (await this.db.getTemplateById(contract.contract_template_id));
    const resolvedSigner =
      signer ??
      (await this.getSignerForBusiness(contract.business_id));
    if (!resolvedTemplate) {
      throw new BadRequestException('Contract template not found');
    }

    const templateId = this.resolveTemplateId(
      resolvedTemplate,
      resolvedSigner.locale
    );
    const title = resolvedTemplate.title ?? 'RendaSua Merchant Agreement';

    try {
      const { documentId } = await this.boldsign.sendUsingTemplate({
        templateId,
        signerName: resolvedSigner.name,
        signerEmail: resolvedSigner.email,
        title,
        message: 'Please review and sign your merchant partnership agreement.',
        expirationDays: this.config.expirationDays,
        reminderIntervalDays: this.config.reminderIntervalDays,
      });
      return await this.markContractSent(contract, documentId);
    } catch (error: any) {
      return this.markContractFailed(contract, error);
    }
  }

  private async markContractSent(
    contract: BusinessContractRow,
    documentId: string
  ): Promise<BusinessContractRow> {
    const sentAt = new Date().toISOString();
    const patch = {
      boldsign_document_id: documentId,
      status: 'sent' as const,
      sent_at: sentAt,
      failure_reason: null,
      failed_at: null,
    };
    try {
      await this.db.updateContract(contract.id, patch);
      return { ...contract, ...patch };
    } catch (error: any) {
      if (!this.isInFlightConflict(error)) throw error;
      const existing = await this.db.getInFlightContract(contract.business_id);
      if (existing && existing.id !== contract.id) {
        await this.cancelSupersededContract(contract.id, existing.id, documentId);
        return existing;
      }
      throw error;
    }
  }

  private async markContractFailed(
    contract: BusinessContractRow,
    error: any
  ): Promise<BusinessContractRow> {
    const reason = error?.message ?? 'Document creation failed';
    this.logger.error(
      `BoldSign create failed for ${contract.business_id}: ${reason}`
    );
    await this.db.updateContract(contract.id, {
      status: 'failed',
      failure_reason: reason,
      failed_at: new Date().toISOString(),
    });
    return { ...contract, status: 'failed', failure_reason: reason };
  }

  private async resumeInFlightContract(
    contract: BusinessContractRow
  ): Promise<BusinessContractRow> {
    if (
      contract.status === 'not_sent' &&
      contract.boldsign_document_id.startsWith('pending:')
    ) {
      return this.sendBoldSignForRow(contract);
    }
    return contract;
  }

  private async resolveInFlightConflict(
    contract: BusinessContractRow
  ): Promise<BusinessContractRow | null> {
    const inFlight = await this.db.getInFlightContract(contract.business_id);
    if (!inFlight || inFlight.id === contract.id) return null;
    await this.cancelSupersededContract(contract.id, inFlight.id);
    return this.resumeInFlightContract(inFlight);
  }

  private async cancelSupersededContract(
    contractId: string,
    keptContractId: string,
    orphanDocumentId?: string
  ): Promise<void> {
    const reason = orphanDocumentId
      ? `Superseded by contract ${keptContractId}; BoldSign doc ${orphanDocumentId}`
      : `Superseded by contract ${keptContractId}`;
    await this.db.updateContract(contractId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      failure_reason: reason,
    });
    if (orphanDocumentId) {
      this.logger.warn(
        `Orphaned BoldSign document ${orphanDocumentId} for cancelled contract ${contractId}`
      );
    }
  }

  private async applyWebhookEvent(
    contract: BusinessContractRow | null,
    eventType: string,
    payload: BoldSignWebhookPayload
  ): Promise<void> {
    if (!contract) return;
    const nextStatus = mapBoldSignEventToStatus(eventType);
    if (eventType === 'Reassigned') {
      await this.applyReassigned(contract, payload);
      return;
    }
    if (!nextStatus) return;
    if (!canTransitionContractStatus(contract.status, nextStatus)) return;

    if (nextStatus === 'signed') {
      try {
        await this.storeSignedArtifacts(
          contract.id,
          contract.boldsign_document_id
        );
      } catch (error: any) {
        this.logger.warn(
          `Signed PDF store failed for ${contract.id}: ${error?.message}`
        );
      }
      const updates = this.buildStatusUpdates(
        contract.status,
        nextStatus,
        payload
      );
      await this.db.updateContract(contract.id, updates);
      await this.merchantLifecycleService.recompute(
        contract.business_id,
        'contract_signed'
      );
      return;
    }

    const updates = this.buildStatusUpdates(contract.status, nextStatus, payload);
    await this.db.updateContract(contract.id, updates);

    if (nextStatus === 'declined') {
      await this.notificationsService.sendAdminContractDeclinedEmail({
        businessId: contract.business_id,
        signerEmail: contract.signer_email ?? '',
      });
    }
  }

  private buildStatusUpdates(
    current: ContractStatus,
    next: ContractStatus,
    payload: BoldSignWebhookPayload
  ): Record<string, unknown> {
    const now = new Date().toISOString();
    const signer = payload.data?.signerDetails?.[0];
    const updates: Record<string, unknown> = { status: next };
    if (next === 'viewed' && !current) updates.viewed_at = now;
    if (next === 'viewed') updates.viewed_at = now;
    if (next === 'signed') updates.signed_at = now;
    if (next === 'declined') {
      updates.declined_at = now;
      updates.decline_reason = signer?.declineMessage ?? null;
    }
    if (next === 'expired') updates.expired_at = now;
    if (next === 'cancelled') updates.cancelled_at = now;
    if (next === 'failed') {
      updates.failed_at = now;
      updates.failure_reason = payload.data?.errorMessage ?? 'Send failed';
    }
    if (signer?.signerName) updates.signer_name = signer.signerName;
    if (signer?.signerEmail) updates.signer_email = signer.signerEmail;
    if (signer?.signerIpAddress) updates.signer_ip_address = signer.signerIpAddress;
    if (signer?.userAgent) updates.signer_user_agent = signer.userAgent;
    return updates;
  }

  private async applyReassigned(
    contract: BusinessContractRow,
    payload: BoldSignWebhookPayload
  ): Promise<void> {
    const signer = payload.data?.signerDetails?.[0];
    if (!signer) return;
    await this.db.updateContract(contract.id, {
      signer_name: signer.signerName ?? contract.signer_name,
      signer_email: signer.signerEmail ?? contract.signer_email,
    });
  }

  async syncSignedArtifactsFromBoldsign(
    contractId: string,
    documentId: string
  ): Promise<void> {
    await this.storeSignedArtifacts(contractId, documentId);
  }

  private async storeSignedArtifacts(
    contractId: string,
    documentId: string
  ): Promise<void> {
    if (documentId.startsWith('legacy:') || documentId.startsWith('pending:')) {
      return;
    }
    const bucket = this.awsService.getDefaultBucketName();
    if (!bucket) return;

    const pdf = await this.boldsign.downloadDocument(documentId);
    const pdfKey = this.awsService.generateUniqueKey(
      `contract-${contractId}.pdf`,
      'contracts/signed'
    );
    await this.uploadBuffer(bucket, pdfKey, pdf, 'application/pdf');

    let auditKey: string | null = null;
    try {
      const audit = await this.boldsign.downloadAuditTrail(documentId);
      auditKey = this.awsService.generateUniqueKey(
        `audit-${contractId}.pdf`,
        'contracts/audit'
      );
      await this.uploadBuffer(bucket, auditKey, audit, 'application/pdf');
    } catch (error: any) {
      this.logger.warn(`Audit download failed for ${documentId}: ${error?.message}`);
    }

    const props = await this.boldsign.getDocumentProperties(documentId);
    await this.db.updateContract(contractId, {
      signed_pdf_s3_key: pdfKey,
      audit_certificate_s3_key: auditKey,
      document_hash: BusinessContractsDatabaseService.hashBuffer(pdf),
      boldsign_raw_metadata: props,
    });
  }

  private async uploadBuffer(
    bucket: string,
    key: string,
    data: Buffer,
    contentType: string
  ): Promise<void> {
    const client = this.awsService.getS3Client();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );
  }

  private async getSignerForBusiness(businessId: string) {
    const query = `
      query Signer($id: uuid!) {
        businesses_by_pk(id: $id) {
          name
          user { email first_name last_name preferred_language }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { id: businessId });
    const biz = res.businesses_by_pk;
    if (!biz?.user?.email) {
      throw new BadRequestException('Business owner email required for contract');
    }
    const name =
      `${biz.user.first_name ?? ''} ${biz.user.last_name ?? ''}`.trim() ||
      biz.name;
    const locale = biz.user.preferred_language?.startsWith('fr') ? 'fr' : 'en';
    return { name, email: biz.user.email, locale };
  }

  private resolveTemplateId(
    template: { boldsign_template_id_en: string; boldsign_template_id_fr?: string | null },
    locale: string
  ): string {
    if (locale === 'fr' && template.boldsign_template_id_fr) {
      return template.boldsign_template_id_fr;
    }
    return template.boldsign_template_id_en;
  }

  private async hasLegacyAgreement(businessId: string): Promise<boolean> {
    const query = `
      query Legacy($id: uuid!) {
        businesses_by_pk(id: $id) {
          merchant_agreement_accepted_at
          merchant_agreement_version
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { id: businessId });
    const biz = res.businesses_by_pk;
    return !!(biz?.merchant_agreement_accepted_at && biz?.merchant_agreement_version);
  }

  private isRetryable(status: ContractStatus): boolean {
    return ['declined', 'expired', 'cancelled', 'failed'].includes(status);
  }

  private isInFlightConflict(error: any): boolean {
    const message = String(error?.message ?? '');
    return (
      message.includes('Uniqueness violation') ||
      message.includes('uq_business_contracts_in_flight')
    );
  }

  private async assertContractAccess(
    contractId: string,
    businessId: string
  ): Promise<BusinessContractRow> {
    const contract = await this.db.getContractById(contractId);
    if (!contract || contract.business_id !== businessId) {
      throw new ForbiddenException('Contract not found');
    }
    return contract;
  }

  private buildEventId(
    payload: BoldSignWebhookPayload,
    documentId: string,
    eventType: string
  ): string {
    if (payload.event?.id) return payload.event.id;
    const ts = payload.event?.created ?? Date.now();
    return createHash('sha256')
      .update(`${documentId}|${eventType}|${ts}`)
      .digest('hex');
  }
}
