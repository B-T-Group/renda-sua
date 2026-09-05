import type { PersonaId } from '../users/persona.types';
import type { MetaActionSource } from '../meta-conversions/meta-conversions.types';
import type { Auth0TokenResponse } from './auth0.service';

export const SIGNUP_ATTEMPT_TTL_MS = 15 * 60 * 1000;
export const SIGNUP_OTP_RESEND_COOLDOWN_MS = 120 * 1000;
export const SIGNUP_MAX_VERIFY_ATTEMPTS = 5;

export type SignupAttemptChannel = 'email' | 'phone';

export type SignupAttemptStatus =
  | 'pending'
  | 'verifying'
  | 'verified_pending_provision'
  | 'completed'
  | 'expired'
  | 'superseded'
  | 'failed';

export interface SignupAttemptPayload {
  first_name: string;
  last_name: string;
  email: string | null;
  phone_number: string | null;
  personas: PersonaId[];
  profile: {
    vehicle_type_id?: string;
    name?: string;
    main_interest?: 'sell_items' | 'rent_items';
    agent_focus?: 'delivery' | 'commercial' | 'both';
  };
  country?: string;
  store_location?: {
    street: string;
    city: string;
    region: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };
  address?: {
    address_line_1: string;
    country: string;
    city: string;
    state: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };
  referral_agent_code?: string;
  fbc?: string | null;
  fbp?: string | null;
  eventSourceUrl?: string;
  actionSource?: MetaActionSource;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

export interface SignupAttemptRow {
  id: string;
  channel: SignupAttemptChannel;
  contact_value: string;
  payload: SignupAttemptPayload;
  status: SignupAttemptStatus;
  expires_at: string;
  last_otp_sent_at: string;
  verify_attempt_count: number;
  auth0_verified_at: string | null;
  completed_user_id: string | null;
  completion_result: SignupCompletionResult | null;
  created_at: string;
  updated_at: string;
}

export interface SignupCreatedUser {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  user_type_id: string;
  phone_number: string | null;
  email_verified: boolean;
}

export interface SignupLaunchPromoResult {
  status: string;
  ordersRemaining: number;
  businessLimit: number | null;
  zeroCommissionOrders: number | null;
  identificationWindowDays: number | null;
}

export interface SignupCompletionResult {
  tokens: Auth0TokenResponse;
  user: SignupCreatedUser;
  launchPromo: SignupLaunchPromoResult | null;
}

export interface SignupStartAttemptResult {
  attemptId: string;
  channel: SignupAttemptChannel;
  contactHint: string;
  expiresAt: string;
  resendAvailableAt: string;
}
