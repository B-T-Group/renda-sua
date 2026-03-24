import { Box } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import React from 'react';

export type SignupGoalId =
  | 'browse_buy'
  | 'rent_and_earn'
  | 'sell_items'
  | 'delivery_agent';

const floatY = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
`;

const artSx = (delay: string) => ({
  width: '100%',
  maxHeight: 108,
  height: 'auto',
  display: 'block',
  animation: `${floatY} 3.2s ease-in-out infinite`,
  animationDelay: delay,
});

interface ArtProps {
  accent: string;
  delay?: string;
}

/** Shopping bag + friendly sparkles */
export const BrowseBuyIllustration: React.FC<ArtProps> = ({
  accent,
  delay = '0s',
}) => (
  <Box
    component="svg"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    sx={artSx(delay)}
  >
    <path
      d="M38 48h44l-6 52H44L38 48z"
      stroke={accent}
      strokeWidth={2.5}
      strokeLinejoin="round"
      fill={`${accent}18`}
    />
    <path
      d="M48 48V40c0-6.6 5.4-12 12-12s12 5.4 12 12v8"
      stroke={accent}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    <circle cx="32" cy="28" r="3" fill={accent} opacity={0.35} />
    <circle cx="88" cy="32" r="2.5" fill={accent} opacity={0.45} />
    <path
      d="M24 36l4 4M92 44l-4 4"
      stroke={accent}
      strokeWidth={2}
      strokeLinecap="round"
      opacity={0.5}
    />
  </Box>
);

/** Item with coin — rent & earn */
export const RentAndEarnIllustration: React.FC<ArtProps> = ({
  accent,
  delay = '0.15s',
}) => (
  <Box
    component="svg"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    sx={artSx(delay)}
  >
    <rect
      x="36"
      y="38"
      width="48"
      height="56"
      rx="8"
      stroke={accent}
      strokeWidth={2.5}
      fill={`${accent}14`}
    />
    <path
      d="M48 52h24M48 64h18"
      stroke={accent}
      strokeWidth={2}
      strokeLinecap="round"
      opacity={0.6}
    />
    <circle
      cx="78"
      cy="30"
      r="14"
      stroke={accent}
      strokeWidth={2.5}
      fill={`${accent}22`}
    />
    <text
      x="78"
      y="35"
      textAnchor="middle"
      fill={accent}
      fontSize="14"
      fontWeight="700"
      fontFamily="system-ui, sans-serif"
    >
      $
    </text>
  </Box>
);

/** Storefront — sell items */
export const SellItemsIllustration: React.FC<ArtProps> = ({
  accent,
  delay = '0.08s',
}) => (
  <Box
    component="svg"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    sx={artSx(delay)}
  >
    <path
      d="M28 52h64v48H28V52z"
      stroke={accent}
      strokeWidth={2.5}
      fill={`${accent}12`}
    />
    <path
      d="M28 52l8-16h48l8 16"
      stroke={accent}
      strokeWidth={2.5}
      strokeLinejoin="round"
      fill={`${accent}18`}
    />
    <rect x="40" y="64" width="16" height="20" rx="2" fill={accent} opacity={0.35} />
    <rect x="64" y="64" width="16" height="20" rx="2" fill={accent} opacity={0.22} />
    <rect x="52" y="36" width="16" height="8" rx="2" fill={accent} opacity={0.5} />
  </Box>
);

/** Delivery scooter */
export const DeliveryAgentIllustration: React.FC<ArtProps> = ({
  accent,
  delay = '0.12s',
}) => (
  <Box
    component="svg"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    sx={artSx(delay)}
  >
    <ellipse cx="40" cy="88" rx="10" ry="10" stroke={accent} strokeWidth={2.5} fill={`${accent}10`} />
    <ellipse cx="82" cy="88" rx="10" ry="10" stroke={accent} strokeWidth={2.5} fill={`${accent}10`} />
    <path
      d="M32 88h56M48 88V58h20l14 14v16"
      stroke={accent}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="52"
      y="44"
      width="28"
      height="22"
      rx="4"
      stroke={accent}
      strokeWidth={2}
      fill={`${accent}20`}
    />
    <path
      d="M68 36c6 0 10 4 10 10v6H58v-6c0-6 4-10 10-10z"
      stroke={accent}
      strokeWidth={2}
      fill={`${accent}14`}
    />
  </Box>
);

export function SignupGoalIllustration({
  goalId,
  accent,
}: {
  goalId: SignupGoalId;
  accent: string;
}) {
  switch (goalId) {
    case 'browse_buy':
      return <BrowseBuyIllustration accent={accent} />;
    case 'rent_and_earn':
      return <RentAndEarnIllustration accent={accent} />;
    case 'sell_items':
      return <SellItemsIllustration accent={accent} />;
    case 'delivery_agent':
      return <DeliveryAgentIllustration accent={accent} />;
    default:
      return null;
  }
}
