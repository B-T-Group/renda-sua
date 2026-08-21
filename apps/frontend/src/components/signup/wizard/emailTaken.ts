/** True when the contact email belongs to someone else's existing account. */
export function isEmailTakenByOtherAccount(
  emailTaken: boolean,
  contactEmail: string,
  ownPendingEmail?: string | null
): boolean {
  if (!emailTaken) return false;
  const contact = contactEmail.trim().toLowerCase();
  const own = (ownPendingEmail || '').trim().toLowerCase();
  return !own || contact !== own;
}
