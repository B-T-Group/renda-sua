import type { User } from '../stores/AuthStore';
import { agentApi } from '../services/agentApi';
import { mobilePaymentPhonesApi } from '../services/mobilePaymentPhonesApi';

type LinkedPhone = { is_default?: boolean; phone_e164?: string | null };

/** Linked Mobile Money number, then the users-table phone, then the session phone. */
export function pickClaimTopupPhone(params: {
  linkedPhones?: LinkedPhone[] | null;
  profilePhone?: string | null;
  authPhone?: string | null;
}): string {
  const phones = params.linkedPhones ?? [];
  const linked =
    phones.find((phone) => phone.is_default)?.phone_e164?.trim() ||
    phones[0]?.phone_e164?.trim() ||
    '';
  if (linked) return linked;
  return params.profilePhone?.trim() || params.authPhone?.trim() || '';
}

/** Phone from Auth0-backed session (often empty for email/password accounts). */
export function defaultClaimTopupPhone(user: User | null | undefined): string {
  return user?.phoneNumber?.trim() ?? '';
}

/**
 * Default phone for claim-with-top-up. The linked Mobile Money number is used
 * when one exists; otherwise the users-table phone. The user may still edit it.
 */
export async function resolveDefaultClaimTopupPhone(
  user: User | null | undefined
): Promise<string> {
  let linkedPhones: LinkedPhone[] = [];
  let profilePhone = '';
  try {
    const listed = await mobilePaymentPhonesApi.list();
    linkedPhones = listed.data?.phones ?? [];
  } catch {
    linkedPhones = [];
  }
  try {
    const me = await agentApi.users.getMe();
    profilePhone = me.user?.phone_number?.trim() ?? '';
  } catch {
    profilePhone = '';
  }
  return pickClaimTopupPhone({
    linkedPhones,
    profilePhone,
    authPhone: defaultClaimTopupPhone(user),
  });
}
