/**
 * Unauthenticated auth-related Nest endpoints (availability, deferred signup).
 */

import { Platform } from 'react-native';
import { publicApiGet, publicApiPost } from './publicApiClient';

export interface PhoneAvailabilityResponse {
  taken: boolean;
}

export interface EmailAvailabilityResponse {
  taken: boolean;
}

/** Personas supported by mobile signup (matches Nest `PersonaId` subset used in app). */
export type SignupStartPersona = 'client' | 'agent' | 'business';

export type SignupMainInterest = 'sell_items' | 'rent_items';

export type SignupOtpChannel = 'email' | 'sms';

export interface SignupStartAddress {
  address_line_1: string;
  country: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
}

export interface SignupStoreLocation {
  street: string;
  city: string;
  region: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
}

export interface SignupStartPayload {
  first_name: string;
  last_name: string;
  email: string | null;
  phone_number: string | null;
  personas: SignupStartPersona[];
  user_type_id: SignupStartPersona;
  profile: {
    vehicle_type_id?: string;
    agent_focus?: 'delivery' | 'commercial' | 'both';
    name?: string;
    main_interest?: SignupMainInterest;
  };
  /** ISO 3166-1 alpha-2 — preferred over address.country for full signup. */
  country?: string;
  /** First business location when personas includes business. */
  store_location?: SignupStoreLocation;
  /** @deprecated Prefer country + store_location. Kept for guest/legacy clients. */
  address?: SignupStartAddress;
  /** Optional agent referral code when signing up as a business. */
  referral_agent_code?: string;
  /** Preferred OTP channel; server validates contact exists for the channel. */
  verification_channel?: SignupOtpChannel;
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

export interface SignupLaunchPromo {
  status: string;
  ordersRemaining: number;
  businessLimit: number | null;
  zeroCommissionOrders: number | null;
  identificationWindowDays: number | null;
}

export interface SignupAttemptStartResponse {
  success: boolean;
  attemptId: string;
  channel: SignupOtpChannel;
  expiresAt: string;
  resendAvailableAt: string;
}

export interface SignupVerifyOtpResponse {
  success: boolean;
  verified: boolean;
  attemptId: string;
  user: SignupCreatedUser;
  launchPromo?: SignupLaunchPromo | null;
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export async function getPhoneAvailability(
  phoneE164: string
): Promise<PhoneAvailabilityResponse> {
  return publicApiGet<PhoneAvailabilityResponse>('/auth/phone-availability', {
    phone_number: phoneE164,
  });
}

export async function getEmailAvailability(
  email: string
): Promise<EmailAvailabilityResponse> {
  return publicApiGet<EmailAvailabilityResponse>('/auth/email-availability', {
    email: email.trim().toLowerCase(),
  });
}

export async function postSignupStart(
  payload: SignupStartPayload
): Promise<SignupAttemptStartResponse> {
  return publicApiPost<SignupAttemptStartResponse>('/auth/signup/start', payload, {
    headers: { 'x-rendasua-platform': Platform.OS },
  });
}

export async function postSignupResendOtp(
  attemptId: string
): Promise<SignupAttemptStartResponse> {
  return publicApiPost<SignupAttemptStartResponse>('/auth/signup/resend-otp', {
    attemptId,
  });
}

export async function postSignupVerifyOtp(input: {
  attemptId: string;
  otp: string;
}): Promise<SignupVerifyOtpResponse> {
  return publicApiPost<SignupVerifyOtpResponse>('/auth/signup/verify-otp', input);
}
