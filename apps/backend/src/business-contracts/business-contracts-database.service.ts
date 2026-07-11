import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  BusinessContractRow,
  ContractTemplateRow,
} from './business-contracts.types';

@Injectable()
export class BusinessContractsDatabaseService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getActiveTemplate(): Promise<ContractTemplateRow | null> {
    const query = `
      query ActiveTemplate {
        contract_templates(
          where: { is_active: { _eq: true }, is_legacy: { _eq: false } }
          limit: 1
        ) {
          id version boldsign_template_id_en boldsign_template_id_fr
          title is_active is_legacy resign_required_by
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {});
    return res.contract_templates?.[0] ?? null;
  }

  async getTemplateById(id: string): Promise<ContractTemplateRow | null> {
    const query = `
      query TemplateById($id: uuid!) {
        contract_templates_by_pk(id: $id) {
          id version boldsign_template_id_en boldsign_template_id_fr
          title is_active is_legacy resign_required_by
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { id });
    return res.contract_templates_by_pk ?? null;
  }

  async listTemplates(): Promise<ContractTemplateRow[]> {
    const query = `
      query ListTemplates {
        contract_templates(order_by: { created_at: desc }) {
          id version boldsign_template_id_en boldsign_template_id_fr
          title is_active is_legacy resign_required_by created_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {});
    return res.contract_templates ?? [];
  }

  async getLatestContract(businessId: string): Promise<BusinessContractRow | null> {
    const query = `
      query LatestContract($businessId: uuid!) {
        business_contracts(
          where: { business_id: { _eq: $businessId } }
          order_by: { created_at: desc }
          limit: 1
        ) {
          id business_id contract_template_id contract_version boldsign_document_id
          status signer_name signer_email signer_ip_address signer_user_agent
          sent_at viewed_at signed_at declined_at expired_at cancelled_at failed_at
          decline_reason failure_reason signed_pdf_s3_key audit_certificate_s3_key
          document_hash invalidated_at invalidation_reason created_at updated_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { businessId });
    return res.business_contracts?.[0] ?? null;
  }

  async getInFlightContract(
    businessId: string
  ): Promise<BusinessContractRow | null> {
    const query = `
      query InFlightContract($businessId: uuid!) {
        business_contracts(
          where: {
            business_id: { _eq: $businessId }
            status: { _in: [not_sent, sent, viewed] }
          }
          order_by: { created_at: desc }
          limit: 1
        ) {
          id business_id contract_template_id contract_version boldsign_document_id
          status signer_name signer_email sent_at viewed_at signed_at created_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { businessId });
    return res.business_contracts?.[0] ?? null;
  }

  async listContracts(businessId: string): Promise<BusinessContractRow[]> {
    const query = `
      query ListContracts($businessId: uuid!) {
        business_contracts(
          where: { business_id: { _eq: $businessId } }
          order_by: { created_at: desc }
        ) {
          id business_id contract_template_id contract_version boldsign_document_id
          status signer_name signer_email sent_at viewed_at signed_at
          declined_at expired_at cancelled_at failed_at decline_reason failure_reason
          signed_pdf_s3_key audit_certificate_s3_key invalidated_at created_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { businessId });
    return res.business_contracts ?? [];
  }

  async getContractById(id: string): Promise<BusinessContractRow | null> {
    const query = `
      query ContractById($id: uuid!) {
        business_contracts_by_pk(id: $id) {
          id business_id contract_template_id contract_version boldsign_document_id
          status signer_name signer_email signer_ip_address signer_user_agent
          sent_at viewed_at signed_at declined_at expired_at cancelled_at failed_at
          decline_reason failure_reason signed_pdf_s3_key audit_certificate_s3_key
          document_hash invalidated_at invalidation_reason created_at updated_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { id });
    return res.business_contracts_by_pk ?? null;
  }

  async getContractByBoldsignId(
    documentId: string
  ): Promise<BusinessContractRow | null> {
    const query = `
      query ContractByDoc($docId: String!) {
        business_contracts(
          where: { boldsign_document_id: { _eq: $docId } }
          limit: 1
        ) {
          id business_id contract_template_id contract_version boldsign_document_id
          status signer_name signer_email signer_ip_address signer_user_agent
          sent_at viewed_at signed_at declined_at expired_at cancelled_at failed_at
          decline_reason failure_reason signed_pdf_s3_key audit_certificate_s3_key
          document_hash invalidated_at created_at updated_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      docId: documentId,
    });
    return res.business_contracts?.[0] ?? null;
  }

  async hasValidSignedContract(businessId: string): Promise<boolean> {
    const query = `
      query ValidContract($businessId: uuid!) {
        legacy: business_contracts(
          where: {
            business_id: { _eq: $businessId }
            status: { _eq: signed }
            invalidated_at: { _is_null: true }
            contract_template: { is_legacy: { _eq: true } }
          }
          limit: 1
        ) { id }
        active: business_contracts(
          where: {
            business_id: { _eq: $businessId }
            status: { _eq: signed }
            invalidated_at: { _is_null: true }
            contract_template: { is_active: { _eq: true }, is_legacy: { _eq: false } }
          }
          limit: 1
        ) { id }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { businessId });
    return !!(res.legacy?.length || res.active?.length);
  }

  async insertContract(row: Record<string, unknown>): Promise<BusinessContractRow> {
    const mutation = `
      mutation InsertContract($row: business_contracts_insert_input!) {
        insert_business_contracts_one(object: $row) {
          id business_id contract_template_id contract_version boldsign_document_id
          status signer_name signer_email sent_at signed_at created_at updated_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeMutation(mutation, { row });
    return res.insert_business_contracts_one;
  }

  async updateContract(
    id: string,
    set: Record<string, unknown>
  ): Promise<void> {
    const mutation = `
      mutation UpdateContract($id: uuid!, $set: business_contracts_set_input!) {
        update_business_contracts_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, { id, set });
  }

  async recordEvent(params: {
    eventId: string;
    eventType: string;
    documentId: string;
    contractId?: string | null;
    payload: unknown;
    signatureValid: boolean;
  }): Promise<boolean> {
    const mutation = `
      mutation InsertEvent($row: business_contract_events_insert_input!) {
        insert_business_contract_events_one(
          object: $row
          on_conflict: { constraint: business_contract_events_event_id_key, update_columns: [] }
        ) { id }
      }
    `;
    const response = await this.hasuraSystemService.executeMutation(mutation, {
      row: {
        event_id: params.eventId,
        event_type: params.eventType,
        boldsign_document_id: params.documentId,
        business_contract_id: params.contractId ?? null,
        payload: params.payload,
        signature_valid: params.signatureValid,
      },
    });
    return !!response.insert_business_contract_events_one?.id;
  }

  async getEventByEventId(eventId: string): Promise<{
    id: string;
    processed_at?: string | null;
    signature_valid: boolean;
  } | null> {
    const query = `
      query EventById($eventId: String!) {
        business_contract_events(
          where: { event_id: { _eq: $eventId } }
          limit: 1
        ) {
          id processed_at signature_valid
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { eventId });
    return res.business_contract_events?.[0] ?? null;
  }

  async markEventProcessed(eventId: string, error?: string): Promise<void> {
    const mutation = `
      mutation MarkProcessed($eventId: String!, $at: timestamptz!, $err: String) {
        update_business_contract_events(
          where: { event_id: { _eq: $eventId } }
          _set: { processed_at: $at, processing_error: $err }
        ) { affected_rows }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      eventId,
      at: new Date().toISOString(),
      err: error ?? null,
    });
  }

  async listContractEvents(contractId: string) {
    const query = `
      query ContractEvents($contractId: uuid!) {
        business_contract_events(
          where: { business_contract_id: { _eq: $contractId } }
          order_by: { received_at: desc }
          limit: 50
        ) {
          id event_id event_type received_at processed_at processing_error
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { contractId });
    return res.business_contract_events ?? [];
  }

  async listPendingRetries(): Promise<BusinessContractRow[]> {
    const query = `
      query PendingContracts {
        business_contracts(
          where: { status: { _in: [not_sent, failed] } }
          order_by: { created_at: asc }
          limit: 20
        ) {
          id business_id contract_template_id contract_version boldsign_document_id
          status signer_name signer_email created_at
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {});
    return res.business_contracts ?? [];
  }

  async listStaleSentContracts(cutoff: string): Promise<BusinessContractRow[]> {
    const query = `
      query StaleSent($cutoff: timestamptz!) {
        business_contracts(
          where: {
            status: { _in: [sent, viewed] }
            sent_at: { _lt: $cutoff }
          }
          limit: 20
        ) {
          id boldsign_document_id status sent_at business_id
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, { cutoff });
    return res.business_contracts ?? [];
  }

  async listContractsNeedingReminder(
    sentBefore: string,
    remindedBefore: string
  ): Promise<BusinessContractRow[]> {
    const query = `
      query NeedReminder($sentBefore: timestamptz!, $remindedBefore: timestamptz!) {
        business_contracts(
          where: {
            status: { _in: [sent, viewed] }
            sent_at: { _lt: $sentBefore }
            _or: [
              { last_reminded_at: { _is_null: true } }
              { last_reminded_at: { _lt: $remindedBefore } }
            ]
          }
          limit: 20
        ) {
          id boldsign_document_id status sent_at business_id
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery(query, {
      sentBefore,
      remindedBefore,
    });
    return res.business_contracts ?? [];
  }

  static hashBuffer(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
  }
}
