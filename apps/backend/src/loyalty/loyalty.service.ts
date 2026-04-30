import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type DiscountCodeType = 'first_order_discount_code';

type ApplicationConfigurationRow = {
  config_key: string;
  number_value: number | null;
  status: string;
  country_code: string | null;
};

type DiscountCodeRow = {
  id: string;
  code: string;
  discount_type: DiscountCodeType;
  created_for_client_id: string;
  created_for_order_id: string;
};

type DiscountCodeOwner = {
  clientId: string;
  email: string;
  preferredLanguage: string | null;
  firstName: string | null;
  lastName: string | null;
};

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getDiscountPercentage(): Promise<number> {
    const query = `
      query GetFirstOrderDiscountPercentage {
        application_configurations(
          where: {
            config_key: { _eq: "first_order_discount_percentage" },
            status: { _eq: "active" },
            country_code: { _is_null: true }
          },
          limit: 1
        ) {
          config_key
          number_value
          status
          country_code
        }
      }
    `;

    try {
      const res = await this.hasuraSystemService.executeQuery<{
        application_configurations: ApplicationConfigurationRow[];
      }>(query);

      const row = res.application_configurations?.[0];
      const value = typeof row?.number_value === 'number' ? row.number_value : 5;
      if (!Number.isFinite(value) || value <= 0) return 5;
      return value;
    } catch (error: any) {
      this.logger.warn(
        `Failed to load first order discount percentage: ${error.message}`
      );
      return 5;
    }
  }

  async generateDiscountCode(params: {
    clientId: string;
    orderId: string;
    type?: DiscountCodeType;
  }): Promise<{ id: string; code: string }> {
    const type: DiscountCodeType = params.type ?? 'first_order_discount_code';

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.generateReadableCode(10);
      try {
        const mutation = `
          mutation InsertOrderDiscountCode(
            $code: String!,
            $discountType: discount_code_type!,
            $clientId: uuid!,
            $orderId: uuid!
          ) {
            insert_order_discount_codes_one(
              object: {
                code: $code,
                discount_type: $discountType,
                created_for_client_id: $clientId,
                created_for_order_id: $orderId
              }
            ) {
              id
              code
            }
          }
        `;

        const res = await this.hasuraSystemService.executeMutation<{
          insert_order_discount_codes_one: { id: string; code: string } | null;
        }>(mutation, {
          code,
          discountType: type,
          clientId: params.clientId,
          orderId: params.orderId,
        });

        const inserted = res.insert_order_discount_codes_one;
        if (!inserted) throw new Error('Failed to insert discount code');
        return inserted;
      } catch (error: any) {
        const message = String(error?.message ?? error);
        if (message.toLowerCase().includes('unique') || message.includes('Uniq')) {
          continue;
        }
        this.logger.error(`Failed to create discount code: ${message}`);
        throw error;
      }
    }

    throw new Error('Failed to generate a unique discount code');
  }

  async validateDiscountCode(
    code: string
  ): Promise<{ valid: boolean; codeId?: string; percentage?: number }> {
    const trimmed = code.trim();
    if (!trimmed) return { valid: false };

    const query = `
      query GetDiscountCode($code: String!) {
        order_discount_codes(where: { code: { _eq: $code } }, limit: 1) {
          id
          code
          discount_type
          created_for_client_id
          created_for_order_id
        }
      }
    `;

    const res = await this.hasuraSystemService.executeQuery<{
      order_discount_codes: DiscountCodeRow[];
    }>(query, { code: trimmed });

    const row = res.order_discount_codes?.[0];
    if (!row) return { valid: false };

    const used = await this.isDiscountCodeUsed(row.id);
    if (used) return { valid: false };

    const percentage = await this.getDiscountPercentage();
    return { valid: true, codeId: row.id, percentage };
  }

  async getCodeOwner(codeId: string): Promise<DiscountCodeOwner | null> {
    const query = `
      query GetDiscountCodeOwner($codeId: uuid!) {
        order_discount_codes_by_pk(id: $codeId) {
          id
          created_for_client {
            id
            user {
              id
              email
              preferred_language
              first_name
              last_name
            }
          }
        }
      }
    `;

    const res = await this.hasuraSystemService.executeQuery<{
      order_discount_codes_by_pk: {
        created_for_client: {
          id: string;
          user: {
            email: string;
            preferred_language: string | null;
            first_name: string | null;
            last_name: string | null;
          } | null;
        } | null;
      } | null;
    }>(query, { codeId });

    const client = res.order_discount_codes_by_pk?.created_for_client;
    const user = client?.user;
    if (!client?.id || !user?.email) return null;

    return {
      clientId: client.id,
      email: user.email,
      preferredLanguage: user.preferred_language,
      firstName: user.first_name,
      lastName: user.last_name,
    };
  }

  private async isDiscountCodeUsed(codeId: string): Promise<boolean> {
    const query = `
      query CheckDiscountCodeUsed($codeId: uuid!) {
        orders_aggregate(
          where: {
            discount_code_id: { _eq: $codeId },
            current_status: { _nin: ["cancelled", "failed"] }
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `;

    const res = await this.hasuraSystemService.executeQuery<{
      orders_aggregate: { aggregate: { count: number } | null } | null;
    }>(query, { codeId });

    return (res.orders_aggregate?.aggregate?.count ?? 0) > 0;
  }

  private generateReadableCode(length: number): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }
}

