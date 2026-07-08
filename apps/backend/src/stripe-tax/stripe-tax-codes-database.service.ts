import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  MerchantStripeTaxCodeDto,
  STRIPE_TAX_CODE_GENERAL_TANGIBLE,
  StripeTaxCodeRow,
} from './stripe-tax.constants';

interface UpsertTaxCodeInput {
  id: string;
  name: string;
  description: string | null;
  requirements: Record<string, unknown> | null;
  group_name: string | null;
  is_active: boolean;
}

@Injectable()
export class StripeTaxCodesDatabaseService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async upsertMany(codes: UpsertTaxCodeInput[]): Promise<number> {
    if (codes.length === 0) return 0;
    const mutation = `
      mutation UpsertStripeTaxCodes($objects: [stripe_tax_codes_insert_input!]!) {
        insert_stripe_tax_codes(
          objects: $objects
          on_conflict: {
            constraint: stripe_tax_codes_pkey
            update_columns: [name, description, requirements, group_name, is_active, synced_at]
          }
        ) {
          affected_rows
        }
      }
    `;
    const objects = codes.map((c) => ({
      ...c,
      synced_at: new Date().toISOString(),
    }));
    const response = await this.hasura.executeMutation(mutation, { objects });
    return response.insert_stripe_tax_codes?.affected_rows ?? 0;
  }

  async deactivateExcept(ids: string[]): Promise<number> {
    const mutation = `
      mutation DeactivateStripeTaxCodes($ids: [String!]!) {
        update_stripe_tax_codes(
          where: {
            is_active: { _eq: true }
            id: { _nin: $ids }
          }
          _set: { is_active: false }
        ) {
          affected_rows
        }
      }
    `;
    const response = await this.hasura.executeMutation(mutation, { ids });
    return response.update_stripe_tax_codes?.affected_rows ?? 0;
  }

  async isActiveCode(id: string): Promise<boolean> {
    const query = `
      query ActiveTaxCode($id: String!) {
        stripe_tax_codes_by_pk(id: $id) {
          id
          is_active
        }
      }
    `;
    const response = await this.hasura.executeQuery(query, { id });
    return response.stripe_tax_codes_by_pk?.is_active === true;
  }

  async search(params: {
    search?: string;
    group?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: StripeTaxCodeRow[]; total: number }> {
    const whereParts: string[] = ['is_active: { _eq: true }'];
    const variables: Record<string, unknown> = {
      limit: params.limit,
      offset: params.offset,
    };
    if (params.group?.trim()) {
      whereParts.push('group_name: { _eq: $group }');
      variables.group = params.group.trim();
    }
    if (params.search?.trim()) {
      whereParts.push(
        '_or: [{ name: { _ilike: $searchPattern } }, { description: { _ilike: $searchPattern } }]'
      );
      variables.searchPattern = `%${params.search.trim()}%`;
    }
    const where = whereParts.join(', ');
    const query = `
      query SearchStripeTaxCodes($limit: Int!, $offset: Int!${params.group ? ', $group: String' : ''}${params.search ? ', $searchPattern: String' : ''}) {
        stripe_tax_codes(
          where: { ${where} }
          order_by: [{ group_name: asc }, { name: asc }]
          limit: $limit
          offset: $offset
        ) {
          id
          name
          description
          requirements
          group_name
          is_active
          synced_at
        }
        stripe_tax_codes_aggregate(where: { ${where} }) {
          aggregate { count }
        }
      }
    `;
    const response = await this.hasura.executeQuery(query, variables);
    return {
      rows: response.stripe_tax_codes ?? [],
      total: response.stripe_tax_codes_aggregate?.aggregate?.count ?? 0,
    };
  }

  async getById(id: string): Promise<StripeTaxCodeRow | null> {
    const query = `
      query TaxCodeById($id: String!) {
        stripe_tax_codes_by_pk(id: $id) {
          id
          name
          description
          requirements
          group_name
          is_active
          synced_at
        }
      }
    `;
    const response = await this.hasura.executeQuery(query, { id });
    return response.stripe_tax_codes_by_pk ?? null;
  }

  toMerchantDto(row: StripeTaxCodeRow): MerchantStripeTaxCodeDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      groupName: row.group_name,
    };
  }

  async ensureDefaultCodeExists(): Promise<void> {
    await this.upsertMany([
      {
        id: STRIPE_TAX_CODE_GENERAL_TANGIBLE,
        name: 'General - Tangible Goods',
        description:
          'A physical good that can be moved or touched. Also known as tangible personal property.',
        requirements: null,
        group_name: 'General',
        is_active: true,
      },
    ]);
  }
}
