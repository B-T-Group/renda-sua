import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { BusinessContractsDatabaseService } from './business-contracts-database.service';

@Injectable()
export class BusinessContractTemplatesService {
  constructor(
    private readonly db: BusinessContractsDatabaseService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  async listTemplates() {
    return this.db.listTemplates();
  }

  async createTemplate(params: {
    version: string;
    boldsignTemplateIdEn: string;
    boldsignTemplateIdFr?: string;
    title?: string;
    changelog?: string;
    adminUserId?: string;
  }) {
    const mutation = `
      mutation CreateTemplate($row: contract_templates_insert_input!) {
        insert_contract_templates_one(object: $row) { id version is_active }
      }
    `;
    const res = await this.hasuraSystemService.executeMutation(mutation, {
      row: {
        version: params.version,
        boldsign_template_id_en: params.boldsignTemplateIdEn,
        boldsign_template_id_fr: params.boldsignTemplateIdFr ?? null,
        title: params.title ?? null,
        changelog: params.changelog ?? null,
        is_active: false,
        created_by_admin_user_id: params.adminUserId ?? null,
      },
    });
    return res.insert_contract_templates_one;
  }

  async activateTemplate(templateId: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation DeactivateAll {
        update_contract_templates(
          where: { is_active: { _eq: true }, is_legacy: { _eq: false } }
          _set: { is_active: false }
        ) { affected_rows }
      }`,
      {}
    );
    await this.hasuraSystemService.executeMutation(
      `mutation Activate($id: uuid!) {
        update_contract_templates_by_pk(
          pk_columns: { id: $id }
          _set: { is_active: true }
        ) { id }
      }`,
      { id: templateId }
    );
  }
}
