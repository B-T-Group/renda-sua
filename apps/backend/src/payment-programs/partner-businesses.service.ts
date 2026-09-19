import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

@Injectable()
export class PartnerBusinessesService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async list() {
    const result = await this.hasura.executeQuery(LIST, {});
    return result.partner_businesses ?? [];
  }

  async set(input: {
    businessId: string;
    isActive: boolean;
    notes?: string | null;
    createdBy?: string | null;
  }) {
    const result = await this.hasura.executeMutation(UPSERT, {
      object: {
        business_id: input.businessId,
        is_active: input.isActive,
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      },
    });
    return result.insert_partner_businesses_one;
  }

  async search(search: string) {
    const term = search.trim();
    if (term.length < 2) return [];
    const result = await this.hasura.executeQuery(SEARCH, {
      where: businessSearchWhere(term),
      limit: 8,
    });
    return (result.businesses ?? []).map(mapBusinessOption);
  }
}

const LIST = `
  query ListPartnerBusinesses {
    partner_businesses(order_by: { created_at: desc }) {
      id business_id is_active notes created_at
      business { id name }
    }
  }
`;

const UPSERT = `
  mutation UpsertPartnerBusiness($object: partner_businesses_insert_input!) {
    insert_partner_businesses_one(
      object: $object
      on_conflict: {
        constraint: partner_businesses_business_id_key
        update_columns: [is_active, notes]
      }
    ) { id business_id is_active }
  }
`;

function businessSearchWhere(term: string) {
  return {
    _and: term.split(/\s+/).filter(Boolean).map((token) => ({
      _or: businessTokenMatches(`%${token}%`),
    })),
  };
}

function businessTokenMatches(pattern: string) {
  return [
    { name: { _ilike: pattern } },
    { business_code: { _ilike: pattern } },
    { user: { email: { _ilike: pattern } } },
    { user: { referral_code: { _ilike: pattern } } },
  ];
}

function mapBusinessOption(row: {
  id: string;
  name?: string;
  business_code?: string | null;
  user?: { email?: string; referral_code?: string | null };
}) {
  return {
    id: row.id,
    name: row.name || row.user?.email || row.id,
    email: row.user?.email ?? '',
    referralCode: row.user?.referral_code || row.business_code || null,
  };
}

const SEARCH = `
  query SearchPaymentProgramBusinesses($where: businesses_bool_exp!, $limit: Int!) {
    businesses(where: $where, limit: $limit, order_by: { created_at: desc }) {
      id name business_code
      user { email referral_code }
    }
  }
`;
