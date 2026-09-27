type LinkedPhone = { is_default?: boolean; phone_e164?: string | null };

/** Linked Mobile Money number, then the phone stored on the user. */
export function pickClaimTopupPhone(
  phones: LinkedPhone[] | null | undefined,
  profilePhone?: string | null
): string {
  const list = phones ?? [];
  const linked =
    list.find((phone) => phone.is_default)?.phone_e164?.trim() ||
    list[0]?.phone_e164?.trim() ||
    '';
  return linked || profilePhone?.trim() || '';
}
