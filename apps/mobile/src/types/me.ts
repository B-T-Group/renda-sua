import type { PersonaSlug } from './persona';
import type { AgentLocationTrackingConsent } from './agentLocationConsent';
import type { ActiveContext, DelegationGrant } from './delegation';

export interface MeUser {
  id: string;
  user_type_id?: string;
  personas?: PersonaSlug[];
  client?: { id?: string } | null;
  agent?: {
    id?: string;
    agent_code?: string;
    focus?: import('./agentFocus').AgentFocus;
    is_verified?: boolean;
    status?: string;
    is_available?: boolean;
    location_tracking_consent_ios?: AgentLocationTrackingConsent;
    location_tracking_consent_android?: AgentLocationTrackingConsent;
  } | null;
  business?: {
    id?: string;
    name?: string;
    is_verified?: boolean;
    main_interest?: 'sell_items' | 'rent_items';
    ai_tokens?: number;
    /** @deprecated Removed from API; use is_superuser / permissions */
    is_admin?: boolean;
    account_type?: 'STANDARD' | 'PREMIUM' | 'ELITE';
    account_type_locked_until?: string | null;
  } | null;
  email?: string;
  first_name?: string;
  last_name?: string;
  /** From Hasura `users.phone_number` (may be set even when Auth0 userinfo has no phone). */
  phone_number?: string | null;
  email_verified?: boolean | null;
  phone_number_verified?: boolean | null;
  profile_picture_url?: string | null;
  timezone?: string | null;
  preferred_language?: string | null;
  created_at?: string;
  /** User-level referral code (persona-agnostic). */
  referral_code?: string | null;
  /** Internal Rendasua employee — higher referral commission. */
  internal?: boolean;
  /** ISO alpha-2 from primary address (GET /users/me). */
  country?: string | null;
  /** Display currency from supported_country_states (GET /users/me). */
  currency?: string | null;
  is_stripe_enabled?: boolean;
  roles?: string[];
  permissions?: string[];
  is_superuser?: boolean;
  /** Additive when location_delegations flag is on (also on MeResponse). */
  delegations?: DelegationGrant[];
  active_context?: ActiveContext | null;
}

export interface MeResponse {
  success: boolean;
  message?: string;
  user?: MeUser;
  userId?: string;
  /** True when /me just created a legacy personal wallet. */
  personalAccountCreated?: boolean;
  /** Session persona when present (null for delegation-only users). */
  active_persona?: PersonaSlug | null;
  /** Location grants when location_delegations flag is on. */
  delegations?: DelegationGrant[];
  /** Active persona or delegation context when flag is on. */
  active_context?: ActiveContext | null;
  auth0User?: {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
}

/** `POST /users/me/update` */
export interface UpdateMeResponse {
  success: boolean;
  user?: MeUser;
  error?: string;
}

/** `POST /users/me/phone` */
export interface SetMyPhoneResponse {
  success: boolean;
  message?: string;
  error?: string;
  user?: MeUser;
}

/** `POST /users/me/update-email` */
export interface UpdateMyEmailResponse {
  success: boolean;
  message?: string;
  error?: string;
  user?: MeUser;
}
