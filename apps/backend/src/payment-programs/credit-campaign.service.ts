import { BadRequestException, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { CreateCampaignDto } from './payment-programs.dto';

@Injectable()
export class CreditCampaignService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async list() {
    const result = await this.hasura.executeQuery(LIST, {});
    return result.credit_campaigns ?? [];
  }

  async create(input: CreateCampaignDto & { createdBy?: string | null }) {
    this.assertWindow(input.startsAt, input.endsAt);
    const result = await this.hasura.executeMutation(INSERT, {
      object: this.insertObject(input),
    });
    return result.insert_credit_campaigns_one;
  }

  async setActive(id: string, isActive: boolean) {
    const result = await this.hasura.executeMutation(SET_ACTIVE, { id, isActive });
    return result.update_credit_campaigns_by_pk;
  }

  private insertObject(input: CreateCampaignDto & { createdBy?: string | null }) {
    const specific = input.storeScope === 'specific_business';
    return {
      name: input.name.trim(),
      country_code: input.countryCode.trim().toUpperCase(),
      persona: input.persona,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      currency: input.currency,
      store_scope: input.storeScope,
      business_id: specific ? input.businessId : null,
      subject_amount: input.subjectAmount,
      subject_bonus_if_referred: input.subjectBonusIfReferred,
      store_credit_expires_days: input.storeCreditExpiresDays ?? null,
      referrer_amount: input.referrerAmount,
      max_referrer_rewards: input.maxReferrerRewards ?? 5,
      created_by: input.createdBy ?? null,
    };
  }

  private assertWindow(startsAt: string, endsAt: string): void {
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      throw new BadRequestException('Campaign end must be after the start');
    }
  }
}

const LIST = `
  query ListCreditCampaigns {
    credit_campaigns(order_by: { created_at: desc }) {
      id name country_code event_type persona starts_at ends_at is_active currency
      store_scope business_id subject_amount subject_bonus_if_referred
      store_credit_expires_days referrer_amount max_referrer_rewards created_at
      business { id name }
    }
  }
`;

const INSERT = `
  mutation InsertCreditCampaign($object: credit_campaigns_insert_input!) {
    insert_credit_campaigns_one(object: $object) { id }
  }
`;

const SET_ACTIVE = `
  mutation SetCreditCampaignActive($id: uuid!, $isActive: Boolean!) {
    update_credit_campaigns_by_pk(pk_columns: { id: $id }, _set: { is_active: $isActive }) { id is_active }
  }
`;
