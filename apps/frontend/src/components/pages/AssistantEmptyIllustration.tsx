import React from 'react';
import { Box } from '@mui/material';

interface Props {
  size?: number;
}

/** Orb + sparkle illustration for the dedicated Assistant page (dark background). */
export function AssistantEmptyIllustration({ size = 160 }: Props) {
  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label="AI Assistant"
      sx={{ display: 'block', mx: 'auto' }}
    >
      <defs>
        <radialGradient id="aeiOrbGrad" cx="38%" cy="33%">
          <stop offset="0%" stopColor="#26c6da" />
          <stop offset="100%" stopColor="#00575e" />
        </radialGradient>
        <radialGradient id="aeiGlowGrad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Outer rings */}
      <circle cx="80" cy="80" r="72" fill="none" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity={0.18} />
      <circle cx="80" cy="80" r="57" fill="none" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity={0.13} />

      {/* Ambient glow */}
      <circle cx="80" cy="80" r="52" fill="url(#aeiGlowGrad)" />

      {/* Central orb */}
      <circle cx="80" cy="80" r="37" fill="url(#aeiOrbGrad)" />

      {/* Shine highlight */}
      <ellipse cx="70" cy="67" rx="9" ry="5" fill="white" fillOpacity={0.18} />

      {/* Typing dots in orb */}
      <circle cx="67" cy="80" r="4.5" fill="white" fillOpacity={0.88} />
      <circle cx="80" cy="80" r="4.5" fill="white" fillOpacity={0.88} />
      <circle cx="93" cy="80" r="4.5" fill="white" fillOpacity={0.88} />

      {/* Sparkle top-right */}
      <path
        d="M122 28 L125 39 L136 42 L125 45 L122 56 L119 45 L108 42 L119 39 Z"
        fill="#00e5ff"
        fillOpacity={0.75}
      />

      {/* Small accent dots */}
      <circle cx="28" cy="58" r="2.2" fill="#00e5ff" fillOpacity={0.38} />
      <circle cx="132" cy="103" r="2.2" fill="#00e5ff" fillOpacity={0.38} />
      <circle cx="43" cy="124" r="1.6" fill="#00e5ff" fillOpacity={0.28} />
      <circle cx="118" cy="118" r="1.6" fill="#00e5ff" fillOpacity={0.22} />
    </Box>
  );
}
