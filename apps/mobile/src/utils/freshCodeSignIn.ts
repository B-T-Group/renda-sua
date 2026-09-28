export type FreshCodeSignInTarget = {
  email?: string | null;
  phone?: string | null;
};

export type FreshCodeSignInParams = {
  prefillEmail?: string;
  prefillPhoneE164?: string;
  autoStartOtp: boolean;
  autoStartNonce: number;
};

/** Email wins. A phone-only profile starts SMS. Blank profiles do not send a code. */
export function freshCodeSignInParams(
  account: FreshCodeSignInTarget,
  nonce: number
): FreshCodeSignInParams {
  const email = account.email?.trim();
  const phone = account.phone?.trim();
  return {
    prefillEmail: email || undefined,
    prefillPhoneE164: !email && phone ? phone : undefined,
    autoStartOtp: Boolean(email || phone),
    autoStartNonce: nonce,
  };
}
