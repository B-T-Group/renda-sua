import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useReducedMotion } from 'framer-motion';
import React from 'react';
import { HOME_ACCENTS } from './homeTheme';

const CommunityStatsIllustration: React.FC = () => {
  const reduceMotion = Boolean(useReducedMotion());
  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        justifyContent: 'center',
        mb: 5,
      }}
    >
      <svg
        viewBox="0 0 480 160"
        style={{ width: '100%', maxWidth: 420, height: 'auto' }}
        aria-hidden="true"
      >
        <circle
          cx="240"
          cy="80"
          r="28"
          fill={alpha(HOME_ACCENTS.primary, 0.12)}
          stroke={HOME_ACCENTS.primary}
          strokeWidth="2"
        />
        <text
          x="240"
          y="85"
          textAnchor="middle"
          fill={HOME_ACCENTS.primary}
          fontSize="11"
          fontWeight="bold"
        >
          Rendasua
        </text>
        <line x1="100" y1="40" x2="214" y2="68" stroke={HOME_ACCENTS.primary} strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="380" y1="40" x2="266" y2="68" stroke={HOME_ACCENTS.business} strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="100" y1="120" x2="214" y2="92" stroke={HOME_ACCENTS.delivery} strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="380" y1="120" x2="266" y2="92" stroke={HOME_ACCENTS.info} strokeWidth="1.5" strokeDasharray="4 3" />
        <StatNode cx={80} cy={40} color={HOME_ACCENTS.primary} label="Clients" pulse={!reduceMotion} />
        <StatNode cx={400} cy={40} color={HOME_ACCENTS.business} label="Shops" pulse={!reduceMotion} />
        <StatNode cx={80} cy={120} color={HOME_ACCENTS.delivery} label="Agents" pulse={!reduceMotion} />
        <StatNode cx={400} cy={120} color={HOME_ACCENTS.info} label="Products" pulse={!reduceMotion} />
      </svg>
    </Box>
  );
};

const StatNode: React.FC<{
  cx: number;
  cy: number;
  color: string;
  label: string;
  pulse: boolean;
}> = ({ cx, cy, color, label, pulse }) => (
  <g>
    <circle cx={cx} cy={cy} r="22" fill={alpha(color, 0.1)} stroke={color} strokeWidth="1.5">
      {pulse ? (
        <animate attributeName="r" values="22;24;22" dur="3s" repeatCount="indefinite" />
      ) : null}
    </circle>
    <text x={cx} y={cy + 4} textAnchor="middle" fill={color} fontSize="9" fontWeight="bold">
      {label}
    </text>
  </g>
);

export default CommunityStatsIllustration;
