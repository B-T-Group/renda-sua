import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useOptionalUserProfileContext } from '../../contexts/UserProfileContext';

/**
 * Client and guest see the Renda character; agent, business, delegate and admin
 * keep the SmartToy icon (spec §1 "Where smart_toy stays"). While a signed-in
 * profile is still loading the persona is unknown and SmartToy is kept, as on
 * mobile (PR-5a) and in the launcher gate, so agent/business never see the
 * character flash in.
 */
export function useShowsRendaCharacter(): boolean {
  const { isAuthenticated } = useSessionAuth();
  const profile = useOptionalUserProfileContext();
  return isRendaPersona(isAuthenticated, profile?.userType ?? null);
}

export function isRendaPersona(
  isAuthenticated: boolean,
  userType: string | null
): boolean {
  if (!isAuthenticated) return true;
  return userType === 'client';
}
