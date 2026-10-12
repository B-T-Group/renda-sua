import type { BoldSignExistingFormField } from '../business-contracts/boldsign-merchant-form-fields';
import type { AgentContractTemplateKey } from './agent-contract-templates';

export interface AgentContractPrefill {
  contractNumber?: string | null;
  signerName?: string | null;
  nationality?: string | null;
  phone?: string | null;
  email?: string | null;
  referralCode?: string | null;
  country?: string | null;
  rendasuaAddress?: string | null;
  address?: string | null;
  city?: string | null;
  idNumber?: string | null;
}

const FIELD_IDS: Record<
  AgentContractTemplateKey,
  Partial<Record<keyof AgentContractPrefill, string[]>>
> = {
  canada_en: {
    contractNumber: ['contract_id'],
    signerName: ['Name1', 'Name2'],
    nationality: ['rep_nationality'],
    phone: ['rep_phone_number'],
    email: ['rep_email', 'Email1'],
    referralCode: ['Recruiter_referral_code'],
    country: ['rep_country_of_residence'],
    rendasuaAddress: ['rendasua_address'],
    address: ['rep_address'],
    city: ['rep_city_of_residence'],
    idNumber: ['rep_id_number'],
  },
  canada_fr: {
    contractNumber: ['contract_number'],
    signerName: ['Name1', 'Name2'],
    nationality: ['rep_nationality'],
    phone: ['agent_phone_number'],
    email: ['agent_email', 'Email1'],
    referralCode: ['Recruiter_referral_code'],
    country: ['rep_country_of_residence'],
    rendasuaAddress: ['rendasua_address'],
    address: ['rep_address'],
    city: ['rep_residence_city'],
    idNumber: ['rep_id_number'],
  },
  central_africa_en: {
    contractNumber: ['contract_id_number'],
    signerName: ['Name1', 'Name2'],
    phone: ['rep_phone_number'],
    email: ['Email1', 'Email2'],
    referralCode: ['Recruiter_referral_code'],
    country: ['client_country'],
    rendasuaAddress: ['rendasua_address'],
    address: ['rep_address'],
    city: ['client_city_of_residence'],
    idNumber: ['rep_id_number'],
  },
  central_africa_fr: {
    contractNumber: ['contract_id_number'],
    signerName: ['Name1', 'Name2'],
    nationality: ['rep_nationality'],
    phone: ['rep_phone_number'],
    email: ['Email1', 'Email2'],
    referralCode: ['Recruiter_reference_code'],
    country: ['rep_country_of_residence'],
    rendasuaAddress: ['rendasua_address'],
    address: ['rep_address'],
    city: ['rep_city_of_residence'],
    idNumber: ['rep_id_number'],
  },
  west_africa_en: {
    contractNumber: ['Contract_id_number'],
    signerName: ['Name1', 'Name2'],
    nationality: ['rep_nationality'],
    phone: ['rep_phone_umber'],
    email: ['Email1', 'Email2'],
    referralCode: ['Recruiter_referral_code'],
    country: ['rep_country_of_residence'],
    rendasuaAddress: ['rendasua_address'],
    address: ['rep_address'],
    city: ['rep_city_of_residence'],
    idNumber: ['id_number'],
  },
  west_africa_fr: {
    contractNumber: ['Contract_id_number'],
    signerName: ['Name1', 'Name2'],
    nationality: ['rep_nationality'],
    phone: ['rep_phone_number'],
    email: ['rep_email', 'Email1'],
    referralCode: ['Recruiter_referral_code'],
    country: ['rep_country'],
    address: ['rep_address'],
    city: ['rep_city_of_residence'],
    idNumber: ['rep_id_number'],
  },
};

export function agentContractFieldIds(
  key: AgentContractTemplateKey
): Partial<Record<keyof AgentContractPrefill, string[]>> {
  return FIELD_IDS[key];
}

export function buildAgentContractFormFields(
  key: AgentContractTemplateKey,
  input: AgentContractPrefill
): BoldSignExistingFormField[] {
  const fields: BoldSignExistingFormField[] = [];
  const ids = FIELD_IDS[key];
  (Object.keys(ids) as (keyof AgentContractPrefill)[]).forEach((name) => {
    pushMapped(fields, ids[name], input[name]);
  });
  return fields;
}

function pushMapped(
  fields: BoldSignExistingFormField[],
  ids: string[] | undefined,
  value?: string | null
): void {
  const trimmed = value?.trim();
  if (!trimmed || !ids?.length) return;
  ids.forEach((id) => fields.push({ id, value: trimmed }));
}
