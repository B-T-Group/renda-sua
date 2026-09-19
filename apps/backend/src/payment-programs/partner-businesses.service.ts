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
