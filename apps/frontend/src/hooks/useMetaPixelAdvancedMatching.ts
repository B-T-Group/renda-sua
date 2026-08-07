import { useEffect, useRef } from 'react';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { META_PIXEL_ID } from '../utils/metaBrowserIds';

type FbqInit = (
  command: 'init',
  pixelId: string,
  advancedMatching?: {
    em?: string;
    ph?: string;
    fn?: string;
    ln?: string;
    external_id?: string;
  }
) => void;

function matchingFingerprint(profile: {
  id: string;
  email?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return [
    profile.id,
    profile.email?.trim().toLowerCase() ?? '',
    (profile.phone_number ?? '').replace(/\D/g, ''),
    profile.first_name?.trim().toLowerCase() ?? '',
    profile.last_name?.trim().toLowerCase() ?? '',
  ].join('|');
}

/**
 * Re-init Meta Pixel with advanced matching when the Hasura user profile (or
 * its PII fields) becomes available so browser events share external_id with
 * CAPI.
 */
export function useMetaPixelAdvancedMatching(): void {
  const { profile } = useUserProfileContext();
  const appliedFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = profile?.id?.trim();
    if (!userId) return;
    if (typeof window === 'undefined') return;

    const fingerprint = matchingFingerprint(profile);
    if (appliedFingerprintRef.current === fingerprint) return;

    const fbq = (window as unknown as { fbq?: FbqInit }).fbq;
    if (typeof fbq !== 'function') return;

    try {
      fbq('init', META_PIXEL_ID, {
        external_id: userId,
        ...(profile.email?.trim() && { em: profile.email.trim().toLowerCase() }),
        ...(profile.phone_number?.trim() && {
          ph: profile.phone_number.replace(/\D/g, ''),
        }),
        ...(profile.first_name?.trim() && {
          fn: profile.first_name.trim().toLowerCase(),
        }),
        ...(profile.last_name?.trim() && {
          ln: profile.last_name.trim().toLowerCase(),
        }),
      });
      appliedFingerprintRef.current = fingerprint;
    } catch {
      // Pixel failures must never break the app.
    }
  }, [profile]);
}
