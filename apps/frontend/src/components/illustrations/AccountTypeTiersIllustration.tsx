import React from 'react';
import { BUSINESS_ACCOUNT_TYPE_PLANS } from '../../constants/businessAccountTypes';

interface AccountTypeTiersIllustrationProps {
  width?: number;
  height?: number;
}

export function AccountTypeTiersIllustration({
  width = 120,
  height = 100,
}: AccountTypeTiersIllustrationProps) {
  const [standard, premium, elite] = BUSINESS_ACCOUNT_TYPE_PLANS;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Three business tiers — Standard, Premium, Elite"
      role="img"
    >
      <rect x="8" y="64" width="28" height="28" rx="4" fill={standard.color} opacity="0.55" />
      <rect x="46" y="42" width="28" height="50" rx="4" fill={premium.color} opacity="0.85" />
      <rect x="84" y="14" width="28" height="78" rx="4" fill={elite.color} />

      <text x="22" y="59" textAnchor="middle" fontSize="12" fill={standard.color}>
        ★
      </text>
      <text x="60" y="37" textAnchor="middle" fontSize="10" fill={premium.color}>
        ★★
      </text>
      <text x="98" y="9" textAnchor="middle" fontSize="8" fill={elite.color}>
        ★★★
      </text>

      <text x="22" y="104" textAnchor="middle" fontSize="7" fill={standard.color}>
        12%
      </text>
      <text x="60" y="104" textAnchor="middle" fontSize="7" fill={premium.color}>
        15%
      </text>
      <text x="98" y="104" textAnchor="middle" fontSize="7" fill={elite.color}>
        20%
      </text>
    </svg>
  );
}
