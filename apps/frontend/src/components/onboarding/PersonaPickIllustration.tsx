import { Box } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import React from 'react';
import type { PersonaSlug } from '../../constants/personaTheme';

const floatY = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const artSx = (delay: string, compact?: boolean) => ({
  width: '100%',
  maxHeight: compact ? 68 : 120,
  height: 'auto',
  display: 'block',
  animation: `${floatY} 3.4s ease-in-out infinite`,
  animationDelay: delay,
});

interface ArtProps {
  accent: string;
  delay?: string;
  compact?: boolean;
}

/** Shopping — client */
const ClientPersonaArt: React.FC<ArtProps> = ({
  accent,
  delay = '0s',
  compact,
}) => (
  <Box
    component="svg"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    sx={artSx(delay, compact)}
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

/** Scooter — agent */
const AgentPersonaArt: React.FC<ArtProps> = ({
  accent,
  delay = '0.1s',
  compact,
}) => (
  <Box
    component="svg"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    sx={artSx(delay, compact)}
  >
    <ellipse
      cx="40"
      cy="88"
      rx="10"
      ry="10"
      stroke={accent}
      strokeWidth={2.5}
      fill={`${accent}12`}
    />
    <ellipse
      cx="82"
      cy="88"
      rx="10"
      ry="10"
      stroke={accent}
      strokeWidth={2.5}
      fill={`${accent}12`}
    />
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
      fill={`${accent}22`}
    />
    <path
      d="M68 36c6 0 10 4 10 10v6H58v-6c0-6 4-10 10-10z"
      stroke={accent}
      strokeWidth={2}
      fill={`${accent}16`}
    />
  </Box>
);

/** Storefront — business */
const BusinessPersonaArt: React.FC<ArtProps> = ({
  accent,
  delay = '0.05s',
  compact,
}) => (
  <Box
    component="svg"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    sx={artSx(delay, compact)}
  >
    <path
      d="M28 52h64v48H28V52z"
      stroke={accent}
      strokeWidth={2.5}
      fill={`${accent}14`}
    />
    <path
      d="M28 52l8-16h48l8 16"
      stroke={accent}
      strokeWidth={2.5}
      strokeLinejoin="round"
      fill={`${accent}1a`}
    />
    <rect x="40" y="64" width="16" height="20" rx="2" fill={accent} opacity={0.35} />
    <rect x="64" y="64" width="16" height="20" rx="2" fill={accent} opacity={0.22} />
    <rect x="52" y="36" width="16" height="8" rx="2" fill={accent} opacity={0.5} />
  </Box>
);

export function PersonaPickIllustration({
  persona,
  accent,
  compact = false,
}: {
  persona: PersonaSlug;
  accent: string;
  compact?: boolean;
}) {
  switch (persona) {
    case 'client':
      return <ClientPersonaArt accent={accent} compact={compact} />;
    case 'agent':
      return <AgentPersonaArt accent={accent} compact={compact} />;
    case 'business':
      return <BusinessPersonaArt accent={accent} compact={compact} />;
    default:
      return null;
  }
}
