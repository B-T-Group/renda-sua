import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BoldsignClientService } from '../business-contracts/boldsign-client.service';
import {
  canTransitionContractStatus,
  mapBoldSignEventToStatus,
} from '../business-contracts/business-contract-status.util';
import type { BoldSignWebhookPayload } from '../business-contracts/business-contracts.types';
import type { ContractStatus } from '../business-contracts/business-contracts.types';
import type { Configuration } from '../config/configuration';
import { AgentContractArtifactsService } from './agent-contract-artifacts.service';
import { AgentContractGateService } from './agent-contract-gate.service';
import {
  AgentContractProfile,
  AgentContractProfileService,
  displayCountry,
} from './agent-contract-profile.service';
import {
  agentContractNumber,
  resolveAgentContractTemplate,
  type AgentContractTemplate,
} from './agent-contract-templates';
import {
  AgentContractRow,
  AgentContractsDatabaseService,
} from './agent-contracts-database.service';
import { buildAgentContractFormFields } from './boldsign-agent-form-fields';

export interface AgentContractEnsureInput {
  language?: 'en' | 'fr' | null;
  nationality?: string | null;
  idNumber?: string | null;
}

export interface AgentContractLanguageNeeds {
  needsNationality: boolean;
  needsIdNumber: boolean;
}

export interface AgentContractStatusView {
  required: boolean;
  signed: boolean;
  status: string | null;
  templateKey: string | null;
  language: 'en' | 'fr';
  byLanguage: Record<'en' | 'fr', AgentContractLanguageNeeds>;
  needsNationality: boolean;
  needsIdNumber: boolean;
  missingPhone: boolean;
  missingEmail: boolean;
  signerEmail: string | null;
}

const RETRYABLE: ContractStatus[] = ['failed', 'declined', 'expired', 'cancelled'];

@Injectable()
export class AgentContractsService {
  private readonly logger = new Logger(AgentContractsService.name);

  constructor(
    private readonly db: AgentContractsDatabaseService,
    private readonly gate: AgentContractGateService,
    private readonly profiles: AgentContractProfileService,
    private readonly boldsign: BoldsignClientService,
    private readonly artifacts: AgentContractArtifactsService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  scheduleForUser(_userId: string): void {
    // The agreement screen sends the contract after the agent picks a language.
  }

  async ensureForUser(
    userId: string,
    input?: AgentContractEnsureInput,
    retryFailures = true
  ): Promise<void> {
    if (!(await this.gate.isRequired())) return;
    if (!this.boldsign.isConfigured()) return;
    const profile = await this.profiles.forUser(userId);
    if (profile) await this.ensureForProfile(profile, input, retryFailures);
  }

  async statusForUser(userId: string): Promise<AgentContractStatusView> {
    return this.readStatus(userId);
  }

  async refreshForUser(userId: string): Promise<AgentContractStatusView> {
    const profile = await this.profiles.forUser(userId);
    if (profile) await this.syncCompleted(profile.agentId).catch(() => undefined);
    return this.readStatus(userId);
  }

  async resendForUser(
    userId: string,
    input?: AgentContractEnsureInput
  ): Promise<AgentContractStatusView> {
    const profile = await this.profiles.forUser(userId);
    if (profile) await this.remindOrEnsure(profile, input);
    return this.readStatus(userId);
  }

  async handleWebhookEvent(payload: BoldSignWebhookPayload): Promise<void> {
    const documentId = payload.data?.documentId;
    const eventType = payload.event?.eventType ?? '';
    if (!documentId) return;
    const contract = await this.db.getByDocumentId(documentId);
    if (!contract) return;
    await this.applyEvent(contract, eventType);
  }

  private async remindOrEnsure(
    profile: AgentContractProfile,
    input?: AgentContractEnsureInput
  ): Promise<void> {
    const inFlight = await this.db.getInFlight(profile.agentId);
    if (inFlight && (inFlight.status === 'sent' || inFlight.status === 'viewed')) {
      await this.remind(inFlight, profile);
      return;
    }
    await this.ensureForProfile(profile, input);
  }

  private async ensureForProfile(
    profile: AgentContractProfile,
    input?: AgentContractEnsureInput,
    retryFailures = true
  ): Promise<void> {
    const inFlight = await this.db.getInFlight(profile.agentId);
    if (inFlight) {
      if (retryFailures) await this.resumePending(inFlight, profile, input);
      return;
    }
    const latest = await this.db.getLatest(profile.agentId);
    if (skipExistingContract(latest, retryFailures)) return;
    const merged = mergeEnsureInput(snapshotInput(latest?.prefill_snapshot), input);
    const template = this.templateFor(profile, merged);
    if (!this.canSend(profile, template, merged)) return;
    await this.createAndSend(profile, template, merged);
  }

  private async resumePending(
    contract: AgentContractRow,
    profile: AgentContractProfile,
    input?: AgentContractEnsureInput
  ): Promise<void> {
    if (!contract.boldsign_document_id.startsWith('pending:')) return;
    if (contract.status !== 'not_sent' && contract.status !== 'failed') return;
    const merged = mergeEnsureInput(snapshotInput(contract.prefill_snapshot), input);
    if (!this.canSend(profile, this.templateFor(profile, merged), merged)) return;
    await this.sendExisting(contract, profile, merged);
  }

  private canSend(
    profile: AgentContractProfile,
    template: AgentContractTemplate,
    input?: AgentContractEnsureInput
  ): boolean {
    // Email only: BoldSign sends the signing link by email; a phone is never required.
    if (!profile.email) return false;
    if (template.needsNationality && !this.nationality(input)) return false;
    if (template.needsIdNumber && !this.idNumber(input)) return false;
    return true;
  }

  private async createAndSend(
    profile: AgentContractProfile,
    template: AgentContractTemplate,
    input?: AgentContractEnsureInput
  ): Promise<void> {
    const contract = await this.insertPending(profile, template, input);
    if (contract) await this.sendExisting(contract, profile, input);
  }

  private async insertPending(
    profile: AgentContractProfile,
    template: AgentContractTemplate,
    input?: AgentContractEnsureInput
  ): Promise<AgentContractRow | null> {
    try {
      return await this.db.insertContract({
        agent_id: profile.agentId,
        template_key: template.key,
        boldsign_template_id: template.boldsignTemplateId,
        boldsign_document_id: `pending:${profile.agentId}:${Date.now()}`,
        contract_number: agentContractNumber(profile.agentCode),
        status: 'not_sent',
        signer_name: profile.signerName || profile.email,
        signer_email: profile.email,
        prefill_snapshot: this.snapshot(input),
      });
    } catch (error: any) {
      if (!isInFlightConflict(error)) throw error;
      return null;
    }
  }

  private async sendExisting(
    contract: AgentContractRow,
    profile: AgentContractProfile,
    input?: AgentContractEnsureInput
  ): Promise<void> {
    const template = this.templateFor(profile, input);
    try {
      const { documentId } = await this.boldsign.sendUsingTemplate({
        templateId: template.boldsignTemplateId,
        signerName: profile.signerName || profile.email,
        signerEmail: profile.email,
        message: signMessage(template.locale),
        expirationDays: this.boldsignConfig.expirationDays,
        reminderIntervalDays: this.boldsignConfig.reminderIntervalDays,
        existingFormFields: this.formFields(profile, template, contract, input),
      });
      await this.db.updateContract(contract.id, {
        boldsign_document_id: documentId,
        boldsign_template_id: template.boldsignTemplateId,
        template_key: template.key,
        status: 'sent',
        sent_at: new Date().toISOString(),
        failure_reason: null,
        failed_at: null,
      });
    } catch (error: any) {
      const detail = boldSignError(error);
      this.logger.warn(`Agent contract send failed: ${detail}`);
      await this.markFailed(contract.id, detail);
    }
  }

  private formFields(
    profile: AgentContractProfile,
    template: AgentContractTemplate,
    contract: AgentContractRow,
    input?: AgentContractEnsureInput
  ) {
    const referral = template.referralRequired
      ? profile.referralCode || '—'
      : profile.referralCode;
    return buildAgentContractFormFields(template.key, {
      contractNumber: contract.contract_number,
      signerName: profile.signerName,
      nationality: this.nationality(input),
      phone: profile.phone,
      email: profile.email,
      referralCode: referral,
      country: displayCountry(profile, template.locale),
      rendasuaAddress: template.rendasuaAddress,
      address: profile.addressLine,
      city: profile.city,
      idNumber: this.idNumber(input),
    });
  }

  private async remind(
    contract: AgentContractRow,
    profile: AgentContractProfile
  ): Promise<void> {
    const template = this.templateFor(profile);
    const result = await this.boldsign.remindDocument(
      contract.boldsign_document_id,
      signMessage(template.locale)
    );
    if (!result.success) this.logger.warn(result.message);
    await this.db.updateContract(contract.id, {
      last_reminded_at: new Date().toISOString(),
    });
  }

  private async syncCompleted(agentId: string): Promise<void> {
    const latest = await this.db.getLatest(agentId);
    if (!latest || (latest.status !== 'sent' && latest.status !== 'viewed')) return;
    if (latest.boldsign_document_id.startsWith('pending:')) return;
    const props = await this.boldsign.getDocumentProperties(latest.boldsign_document_id);
    const status = String((props as { status?: string }).status ?? '').toLowerCase();
    if (status === 'completed') await this.markSigned(latest);
  }

  private async applyEvent(
    contract: AgentContractRow,
    eventType: string
  ): Promise<void> {
    const next = mapBoldSignEventToStatus(eventType);
    if (!next || !canTransitionContractStatus(contract.status, next)) return;
    if (next === 'signed') {
      await this.markSigned(contract);
      return;
    }
    await this.db.updateContract(contract.id, statusPatch(next));
  }

  private async markSigned(contract: AgentContractRow): Promise<void> {
    try {
      await this.artifacts.storeSigned(contract);
    } catch (error: any) {
      this.logger.warn(`Agent signed PDF store failed: ${error?.message}`);
    }
    await this.db.updateContract(contract.id, {
      status: 'signed',
      signed_at: new Date().toISOString(),
    });
    await this.verifySignerEmail(contract);
  }

  private async verifySignerEmail(contract: AgentContractRow): Promise<void> {
    try {
      await this.profiles.verifyEmailAfterSign(contract.agent_id, contract.signer_email);
    } catch (error: any) {
      this.logger.warn(`Agent email verify after sign failed: ${error?.message}`);
    }
  }

  private async readStatus(userId: string): Promise<AgentContractStatusView> {
    const required = await this.gate.isRequired();
    const profile = await this.profiles.forUser(userId);
    if (!profile) return idleStatus(required);
    const template = this.templateFor(profile);
    const signed = await this.db.hasSigned(profile.agentId);
    const latest = await this.db.getLatest(profile.agentId);
    const awaiting = !latest || RETRYABLE.includes(latest.status);
    const language = contractLocale(profile.preferredLanguage);
    return statusView(profile, template, required, signed, latest?.status ?? null, awaiting, language);
  }

  private templateFor(
    profile: AgentContractProfile,
    input?: AgentContractEnsureInput
  ): AgentContractTemplate {
    return resolveAgentContractTemplate({
      country: profile.country,
      addressCountry: profile.addressCountry,
      preferredLanguage: input?.language ?? profile.preferredLanguage,
    });
  }

  private nationality(input?: AgentContractEnsureInput): string | null {
    return input?.nationality?.trim() || null;
  }

  private idNumber(input?: AgentContractEnsureInput): string | null {
    return input?.idNumber?.trim() || null;
  }

  private snapshot(input?: AgentContractEnsureInput): Record<string, string> {
    const language = input?.language;
    return {
      ...(language === 'en' || language === 'fr' ? { language } : {}),
      ...(this.nationality(input) ? { nationality: this.nationality(input)! } : {}),
      ...(this.idNumber(input) ? { idNumber: this.idNumber(input)! } : {}),
    };
  }

  private async markFailed(id: string, message?: string): Promise<void> {
    await this.db.updateContract(id, {
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: message || 'Document creation failed',
    });
  }

  private get boldsignConfig() {
    return this.configService.get('boldsign', { infer: true })!;
  }
}

function needsDetail(
  required: boolean,
  signed: boolean,
  awaitingDetails: boolean,
  fieldNeeded: boolean
): boolean {
  return required && !signed && awaitingDetails && fieldNeeded;
}

function statusView(
  profile: AgentContractProfile,
  template: AgentContractTemplate,
  required: boolean,
  signed: boolean,
  status: string | null,
  awaiting: boolean,
  language: 'en' | 'fr'
): AgentContractStatusView {
  const byLanguage = languageNeeds(profile, required, signed, awaiting);
  return {
    required,
    signed: !required || signed,
    status,
    templateKey: template.key,
    language,
    byLanguage,
    needsNationality: byLanguage[language].needsNationality,
    needsIdNumber: byLanguage[language].needsIdNumber,
    // Kept for older clients; a phone is no longer required (email-only signing).
    missingPhone: false,
    missingEmail: !profile.email,
    signerEmail: profile.email || null,
  };
}

function languageNeeds(
  profile: AgentContractProfile,
  required: boolean,
  signed: boolean,
  awaiting: boolean
): Record<'en' | 'fr', AgentContractLanguageNeeds> {
  return {
    en: needsForLocale(profile, 'en', required, signed, awaiting),
    fr: needsForLocale(profile, 'fr', required, signed, awaiting),
  };
}

function needsForLocale(
  profile: AgentContractProfile,
  locale: 'en' | 'fr',
  required: boolean,
  signed: boolean,
  awaiting: boolean
): AgentContractLanguageNeeds {
  const template = resolveAgentContractTemplate({
    country: profile.country,
    addressCountry: profile.addressCountry,
    preferredLanguage: locale,
  });
  return {
    needsNationality: needsDetail(required, signed, awaiting, template.needsNationality),
    needsIdNumber: needsDetail(required, signed, awaiting, template.needsIdNumber),
  };
}

function contractLocale(preferred?: string | null): 'en' | 'fr' {
  return (preferred ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function idleStatus(required: boolean): AgentContractStatusView {
  return {
    required,
    signed: !required,
    status: null,
    templateKey: null,
    language: 'en',
    byLanguage: {
      en: { needsNationality: false, needsIdNumber: false },
      fr: { needsNationality: false, needsIdNumber: false },
    },
    needsNationality: false,
    needsIdNumber: false,
    missingPhone: false,
    missingEmail: false,
    signerEmail: null,
  };
}

function statusPatch(next: ContractStatus): Record<string, unknown> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: next };
  if (next === 'viewed') patch.viewed_at = now;
  if (next === 'declined') patch.declined_at = now;
  if (next === 'expired') patch.expired_at = now;
  if (next === 'cancelled') patch.cancelled_at = now;
  if (next === 'failed') patch.failed_at = now;
  return patch;
}

function signMessage(locale: 'en' | 'fr'): string {
  return locale === 'fr'
    ? 'Veuillez lire et signer votre contrat d’agent Rendasua.'
    : 'Please review and sign your Rendasua agent agreement.';
}

function skipExistingContract(
  latest: AgentContractRow | null,
  retryFailures: boolean
): boolean {
  if (!latest) return false;
  if (!RETRYABLE.includes(latest.status)) return true;
  return !retryFailures;
}

function snapshotInput(
  snapshot?: Record<string, unknown> | null
): AgentContractEnsureInput {
  return {
    language: snapshotLocale(snapshot?.language),
    nationality: snapshotText(snapshot?.nationality),
    idNumber: snapshotText(snapshot?.idNumber),
  };
}

function mergeEnsureInput(
  saved: AgentContractEnsureInput,
  input?: AgentContractEnsureInput
): AgentContractEnsureInput {
  return {
    language: input?.language || saved.language || null,
    nationality: input?.nationality?.trim() || saved.nationality || null,
    idNumber: input?.idNumber?.trim() || saved.idNumber || null,
  };
}

function snapshotLocale(value: unknown): 'en' | 'fr' | null {
  return value === 'en' || value === 'fr' ? value : null;
}

function snapshotText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function boldSignError(error: any): string {
  const data = error?.response?.data;
  const body = data ? JSON.stringify(data) : '';
  return body || error?.message || 'Document creation failed';
}

function isInFlightConflict(error: any): boolean {
  const message = String(error?.message ?? '');
  return (
    message.includes('Uniqueness violation') ||
    message.includes('uq_agent_contracts_in_flight')
  );
}
