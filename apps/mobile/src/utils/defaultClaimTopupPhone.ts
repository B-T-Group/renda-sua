import type { User } from '../stores/AuthStore';
import { agentApi } from '../services/agentApi';

/** Phone from Auth0-backed session (often empty for email/password accounts). */
export function defaultClaimTopupPhone(user: User | null | undefined): string {
  return user?.phoneNumber?.trim() ?? '';
}

/**
 * Default phone for claim-with-top-up: Auth0 profile first, then `/users/me`
 * (`users.phone_number` in Hasura). User may still edit before confirming.
 */
export async function resolveDefaultClaimTopupPhone(user: User | null | undefined): Promise<string> {
  const fromAuth = defaultClaimTopupPhone(user);
  if (fromAuth) return fromAuth;
  try {
    const res = await agentApi.users.getMe();
    const p = res.user?.phone_number?.trim();
    return p ?? '';
  } catch {
    return '';
  }
}
