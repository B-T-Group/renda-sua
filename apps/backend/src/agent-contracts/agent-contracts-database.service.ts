import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { ContractStatus } from '../business-contracts/business-contracts.types';

export interface AgentContractRow {
  id: string;
  agent_id: string;
  template_key: string;
  boldsign_template_id: string;
  boldsign_document_id: string;
  contract_number: string;
  status: ContractStatus;
  signer_name: string | null;
  signer_email: string | null;
  prefill_snapshot: Record<string, unknown> | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  failure_reason: string | null;
  signed_pdf_s3_key: string | null;
  audit_certificate_s3_key: string | null;
  last_reminded_at: string | null;
}

const CONTRACT_FIELDS = `
  id agent_id template_key boldsign_template_id boldsign_document_id
  contract_number status signer_name signer_email prefill_snapshot
  sent_at viewed_at signed_at failure_reason signed_pdf_s3_key
  audit_certificate_s3_key last_reminded_at
`;

@Injectable()
export class AgentContractsDatabaseService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async hasSigned(agentId: string): Promise<boolean> {
    const ids = await this.signedAgentIds([agentId]);
    return ids.has(agentId);
  }

  async signedAgentIds(agentIds: string[]): Promise<Set<string>> {
    if (!agentIds.length) return new Set();
    const res = await this.hasura.executeQuery<{
      agent_contracts: Array<{ agent_id: string }>;
    }>(SIGNED_QUERY, { ids: agentIds });
    return new Set((res.agent_contracts ?? []).map((row) => row.agent_id));
  }

  async getInFlight(agentId: string): Promise<AgentContractRow | null> {
    return this.first(IN_FLIGHT_QUERY, { agentId });
  }

  async getLatest(agentId: string): Promise<AgentContractRow | null> {
    return this.first(LATEST_QUERY, { agentId });
  }

  async getByDocumentId(documentId: string): Promise<AgentContractRow | null> {
    return this.first(BY_DOCUMENT_QUERY, { documentId });
  }

  async insertContract(
    object: Record<string, unknown>
  ): Promise<AgentContractRow> {
    const res = await this.hasura.executeMutation<{
      insert_agent_contracts_one: AgentContractRow;
    }>(INSERT_CONTRACT, { object });
    return res.insert_agent_contracts_one;
  }

  async updateContract(
    id: string,
    set: Record<string, unknown>
  ): Promise<void> {
    await this.hasura.executeMutation(UPDATE_CONTRACT, { id, set });
  }

  static hashBuffer(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
  }

  private async first(
    query: string,
    variables: Record<string, unknown>
  ): Promise<AgentContractRow | null> {
    const res = await this.hasura.executeQuery<{
      agent_contracts: AgentContractRow[];
    }>(query, variables);
    return res.agent_contracts?.[0] ?? null;
  }
}

const SIGNED_QUERY = `
  query SignedAgentContracts($ids: [uuid!]!) {
    agent_contracts(where: { agent_id: { _in: $ids }, status: { _eq: signed } }) {
      agent_id
    }
  }
`;

const IN_FLIGHT_QUERY = `
  query InFlightAgentContract($agentId: uuid!) {
    agent_contracts(
      where: {
        agent_id: { _eq: $agentId }
        status: { _in: [not_sent, sent, viewed] }
      }
      limit: 1
    ) { ${CONTRACT_FIELDS} }
  }
`;

const LATEST_QUERY = `
  query LatestAgentContract($agentId: uuid!) {
    agent_contracts(
      where: { agent_id: { _eq: $agentId } }
      order_by: { created_at: desc }
      limit: 1
    ) { ${CONTRACT_FIELDS} }
  }
`;

const BY_DOCUMENT_QUERY = `
  query AgentContractByDocument($documentId: String!) {
    agent_contracts(
      where: { boldsign_document_id: { _eq: $documentId } }
      limit: 1
    ) { ${CONTRACT_FIELDS} }
  }
`;

const INSERT_CONTRACT = `
  mutation InsertAgentContract($object: agent_contracts_insert_input!) {
    insert_agent_contracts_one(object: $object) { ${CONTRACT_FIELDS} }
  }
`;

const UPDATE_CONTRACT = `
  mutation UpdateAgentContract($id: uuid!, $set: agent_contracts_set_input!) {
    update_agent_contracts_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;
