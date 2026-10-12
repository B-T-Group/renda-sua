import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { AgentContractsDatabaseService } from './agent-contracts-database.service';

const FLAG_KEY = 'agent_contract_required';

@Injectable()
export class AgentContractGateService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly db: AgentContractsDatabaseService
  ) {}

  async isRequired(): Promise<boolean> {
    try {
      return await this.readFlag();
    } catch {
      return true;
    }
  }

  async canOperate(agentId: string): Promise<boolean> {
    if (!(await this.isRequired())) return true;
    return this.db.hasSigned(agentId);
  }

  async assertCanOperate(agentId: string): Promise<void> {
    if (await this.canOperate(agentId)) return;
    throw new HttpException(
      {
        error: 'AGENT_CONTRACT_REQUIRED',
        message: 'Sign your agent agreement before claiming orders.',
      },
      HttpStatus.FORBIDDEN
    );
  }

  async signedIdsOrSkip(agentIds: string[]): Promise<Set<string> | null> {
    if (!(await this.isRequired())) return null;
    return this.db.signedAgentIds(agentIds);
  }

  private async readFlag(): Promise<boolean> {
    const res = await this.hasura.executeQuery<{
      application_configurations: Array<{ boolean_value: boolean | null }>;
    }>(FLAG_QUERY, { key: FLAG_KEY });
    const row = res.application_configurations?.[0];
    if (!row || row.boolean_value == null) return true;
    return row.boolean_value === true;
  }
}

const FLAG_QUERY = `
  query AgentContractFlag($key: String!) {
    application_configurations(
      where: {
        config_key: { _eq: $key }
        status: { _eq: active }
        country_code: { _is_null: true }
      }
      limit: 1
    ) { boolean_value }
  }
`;
