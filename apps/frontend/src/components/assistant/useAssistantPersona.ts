import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useOptionalUserProfileContext } from '../../contexts/UserProfileContext';

/**
 * Client and guest see the Renda character; agent, business, delegate and admin
 * keep the SmartToy icon (spec §1 "Where smart_toy stays"). While a signed-in
 * profile is still loading the persona is unknown, and the client treatment is
 * used (clients are the vast majority of signed-in users).
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
  return userType == null || userType === 'client';
}
