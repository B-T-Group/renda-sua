/**
 * Field IDs from BoldSign merchant template export
 * (Contrat de Marchand — Juil 2026 FR / matching EN template).
 */
export const MERCHANT_CONTRACT_FIELD_IDS = {
  companyName: 'companyName',
  addressLine1: 'addressLine1',
  state: 'state',
  phone: 'phone',
  website: 'website',
  sector: 'sector',
  email: 'email',
  name1: 'name1',
  name2: 'name2',
} as const;

export interface BoldSignExistingFormField {
  id: string;
  value: string;
}

export interface MerchantContractPrefillInput {
  companyName?: string | null;
  addressLine1?: string | null;
  state?: string | null;
  phone?: string | null;
  website?: string | null;
  sector?: string | null;
  email?: string | null;
  signerName?: string | null;
}

/** Build ExistingFormFields payload for BoldSign template send. */
export function buildMerchantContractFormFields(
  input: MerchantContractPrefillInput
): BoldSignExistingFormField[] {
  const fields: BoldSignExistingFormField[] = [];
  pushField(fields, MERCHANT_CONTRACT_FIELD_IDS.companyName, input.companyName);
  pushField(fields, MERCHANT_CONTRACT_FIELD_IDS.addressLine1, input.addressLine1);
  pushField(fields, MERCHANT_CONTRACT_FIELD_IDS.state, input.state);
  pushField(fields, MERCHANT_CONTRACT_FIELD_IDS.phone, input.phone);
  pushField(fields, MERCHANT_CONTRACT_FIELD_IDS.website, input.website);
  pushField(fields, MERCHANT_CONTRACT_FIELD_IDS.sector, input.sector);
  pushField(fields, MERCHANT_CONTRACT_FIELD_IDS.email, input.email);
  pushField(fields, MERCHANT_CONTRACT_FIELD_IDS.name1, input.signerName);
  pushField(fields, MERCHANT_CONTRACT_FIELD_IDS.name2, input.signerName);
  return fields;
}

function pushField(
  fields: BoldSignExistingFormField[],
  id: string,
  value?: string | null
): void {
  const trimmed = value?.trim();
  if (!trimmed) return;
  fields.push({ id, value: trimmed });
}
