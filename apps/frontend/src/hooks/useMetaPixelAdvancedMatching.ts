import { useEffect, useRef } from 'react';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { META_PIXEL_ID } from '../utils/metaBrowserIds';
import { buildMetaPixelAdvancedMatching } from '../utils/metaPixelAdvancedMatching';

type FbqInit = (
  command: 'init',
  pixelId: string,
  advancedMatching?: ReturnType<typeof buildMetaPixelAdvancedMatching>
) => void;

function matchingFingerprint(
  params: ReturnType<typeof buildMetaPixelAdvancedMatching>
): string {
  return [
    params.external_id ?? '',
    params.em ?? '',
    params.ph ?? '',
    params.fn ?? '',
    params.ln ?? '',
    params.ct ?? '',
    params.st ?? '',
    params.zp ?? '',
    params.country ?? '',
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

    const matching = buildMetaPixelAdvancedMatching(profile);
    const fingerprint = matchingFingerprint(matching);
    if (appliedFingerprintRef.current === fingerprint) return;

    const fbq = (window as unknown as { fbq?: FbqInit }).fbq;
    if (typeof fbq !== 'function') return;

    try {
      fbq('init', META_PIXEL_ID, matching);
      appliedFingerprintRef.current = fingerprint;
    } catch {
      // Pixel failures must never break the app.
    }
  }, [profile]);
}
