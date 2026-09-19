export type CampaignPersona = 'client' | 'agent' | 'business' | 'any';
export type StoreScope = 'any_store' | 'partner_businesses' | 'specific_business';

export interface CreditCampaign {
  id: string;
  name: string;
  country_code: string;
  persona: CampaignPersona;
  currency: string;
  store_scope: StoreScope;
  business_id?: string | null;
  subject_amount: number | string;
  subject_bonus_if_referred: number | string;
  store_credit_expires_days?: number | null;
  referrer_amount: number | string;
  max_referrer_rewards: number;
}

export interface SignupCampaignEvent {
  userId: string;
  personas: string[];
  country: string;
  referrerUserId?: string | null;
}

export function personaMatches(persona: string, personas: string[]): boolean {
  return persona === 'any' || personas.includes(persona);
}

export function subjectStoreAmount(
  row: Pick<CreditCampaign, 'subject_amount' | 'subject_bonus_if_referred'>,
  referred: boolean
): number {
  const base = Number(row.subject_amount) || 0;
  const bonus = referred ? Number(row.subject_bonus_if_referred) || 0 : 0;
  return base + bonus;
}

export function referrerAtCap(posted: number, max: number): boolean {
  return posted >= max;
}

export function creditExpiresAt(days?: number | null, now = new Date()): string | null {
  if (!days) return null;
  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + days);
  return expiry.toISOString();
}
