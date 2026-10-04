import React from 'react';
import { brandTokens } from '../../theme/brandTokens';

export function WalletProgramsIllustration() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true">
      <rect x="18" y="28" width="84" height="52" rx="10" fill={brandTokens.cta.main} />
      <rect x="28" y="40" width="40" height="8" rx="4" fill={brandTokens.cta.soft} />
      <circle cx="86" cy="62" r="10" fill={brandTokens.warning.main} />
      <path d="M18 36h84" stroke={brandTokens.cta.dark} strokeWidth="4" />
    </svg>
  );
}
