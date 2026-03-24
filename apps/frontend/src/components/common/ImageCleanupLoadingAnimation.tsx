import { Box, Typography, keyframes, useTheme } from '@mui/material';
import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';

const framePulse = keyframes`
  0%, 100% {
    opacity: 0.35;
    stroke-dashoffset: 0;
  }
  50% {
    opacity: 1;
    stroke-dashoffset: 14;
  }
`;

const sparkleTwinkle = keyframes`
  0%, 100% {
    opacity: 0.25;
  }
  50% {
    opacity: 1;
  }
`;

const wandFloat = keyframes`
  0%, 100% {
    transform: translateY(0) rotate(-6deg);
  }
  50% {
    transform: translateY(-6px) rotate(6deg);
  }
`;

const orbitSpin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const sweepShine = keyframes`
  0% {
    transform: translateX(-160px);
    opacity: 0;
  }
  35% {
    opacity: 0.4;
  }
  65% {
    opacity: 0.4;
  }
  100% {
    transform: translateX(160px);
    opacity: 0;
  }
`;

/**
 * Vector illustration shown while AI image processing is in progress.
 * Used for both cleanup flows and AI "create from image" flows.
 */
export interface ImageCleanupLoadingAnimationProps {
  /**
   * Optional label shown under the vector illustration.
   * Defaults to the cleanup-specific translation.
   */
  message?: string;
  /**
   * Vertical space reserved for the animation container.
   * Defaults to the original cleanup-dialog size.
   */
  minHeight?: number;
}

const ImageCleanupLoadingAnimation: React.FC<ImageCleanupLoadingAnimationProps> = ({
  message,
  minHeight,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const uid = useId().replace(/:/g, '');
  const gradId = `ic-shine-${uid}`;
  const clipId = `ic-clip-${uid}`;
  const primary = theme.palette.primary.main;
  const light = theme.palette.primary.light;
  const paper = theme.palette.background.paper;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: '100%',
        minHeight: minHeight ?? 280,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
        '& .ic-frame': {
          animation: `${framePulse} 2.4s ease-in-out infinite`,
        },
        '& .ic-sparkle-a': {
          animation: `${sparkleTwinkle} 1.25s ease-in-out infinite`,
        },
        '& .ic-sparkle-b': {
          animation: `${sparkleTwinkle} 1.25s ease-in-out infinite`,
          animationDelay: '0.35s',
        },
        '& .ic-sparkle-c': {
          animation: `${sparkleTwinkle} 1.25s ease-in-out infinite`,
          animationDelay: '0.7s',
        },
        '& .ic-wand': {
          animation: `${wandFloat} 2s ease-in-out infinite`,
          transformOrigin: '172px 48px',
        },
        '& .ic-orbit': {
          animation: `${orbitSpin} 12s linear infinite`,
          transformOrigin: '110px 80px',
        },
        '& .ic-shine': {
          animation: `${sweepShine} 2.8s ease-in-out infinite`,
        },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 220 160"
        sx={{
          width: 'min(92%, 240px)',
          height: 'auto',
          display: 'block',
        }}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={light} stopOpacity="0" />
            <stop offset="50%" stopColor={light} stopOpacity="0.9" />
            <stop offset="100%" stopColor={light} stopOpacity="0" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x="42" y="28" width="136" height="104" rx="12" />
          </clipPath>
        </defs>

        <rect
          x="40"
          y="26"
          width="140"
          height="108"
          rx="14"
          fill={paper}
          opacity={0.65}
          stroke={primary}
          strokeWidth="1"
        />

        <g clipPath={`url(#${clipId})`}>
          <rect x="42" y="28" width="136" height="104" fill={light} opacity={0.12} />
          <path
            d="M48 122 L78 82 L102 98 L128 62 L158 88 L176 122 Z"
            fill={primary}
            opacity={0.15}
          />
          <rect
            className="ic-shine"
            x="42"
            y="28"
            width="136"
            height="104"
            fill={`url(#${gradId})`}
            opacity={0.55}
          />
        </g>

        <rect
          className="ic-frame"
          x="40"
          y="26"
          width="140"
          height="108"
          rx="14"
          fill="none"
          stroke={primary}
          strokeWidth="2.5"
          strokeDasharray="10 8"
        />

        <g className="ic-orbit">
          <circle
            cx="110"
            cy="80"
            r="58"
            fill="none"
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="4 10"
            opacity={0.35}
          />
        </g>

        <g className="ic-sparkle-a">
          <path
            d="M110 64 L112 72 L120 74 L112 76 L110 84 L108 76 L100 74 L108 72 Z"
            fill={primary}
          />
        </g>
        <g className="ic-sparkle-b">
          <path
            d="M168 88 L169 93 L174 94 L169 95 L168 100 L167 95 L162 94 L167 93 Z"
            fill={primary}
          />
        </g>
        <g className="ic-sparkle-c">
          <path
            d="M52 92 L54 98 L60 99 L54 100 L52 106 L50 100 L44 99 L50 98 Z"
            fill={primary}
          />
        </g>

        <g className="ic-wand">
          <line
            x1="158"
            y1="58"
            x2="198"
            y2="38"
            stroke={primary}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M196 34 L206 30 L210 40 L200 44 Z"
            fill={light}
            stroke={primary}
            strokeWidth="1.2"
          />
          <circle cx="204" cy="32" r="5" fill={light} opacity={0.85} />
        </g>
      </Box>

      <Typography variant="body2" color="text.secondary" textAlign="center" px={2}>
        {message ?? t('business.images.cleanup.loading', 'Cleaning up image...')}
      </Typography>
    </Box>
  );
};

export default ImageCleanupLoadingAnimation;
