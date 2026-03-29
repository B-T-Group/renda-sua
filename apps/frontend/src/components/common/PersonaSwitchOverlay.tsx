import { Backdrop, Box, Typography, useTheme } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';

const orbit = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const bob = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

const pulseRing = keyframes`
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.85; transform: scale(1.08); }
`;

export interface PersonaSwitchOverlayProps {
  open: boolean;
  targetLabel: string;
}

/**
 * Full-screen overlay with a lightweight vector-style animation while switching persona.
 */
const PersonaSwitchOverlay: React.FC<PersonaSwitchOverlayProps> = ({
  open,
  targetLabel,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Backdrop
      open={open}
      sx={{
        zIndex: theme.zIndex.modal + 3,
        flexDirection: 'column',
        gap: 2,
        px: 3,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: 220,
          height: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            animation: `${orbit} 14s linear infinite`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="svg"
            viewBox="0 0 200 200"
            sx={{
              width: '100%',
              height: '100%',
              overflow: 'visible',
            }}
            aria-hidden
          >
            <defs>
              <linearGradient id="personaSwitchRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="50%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>
            </defs>
            <circle
              cx="100"
              cy="100"
              r="72"
              fill="none"
              stroke="url(#personaSwitchRing)"
              strokeWidth="1.5"
              strokeDasharray="8 14"
              opacity={0.5}
            />
            <circle
              cx="100"
              cy="100"
              r="52"
              fill="none"
              stroke="url(#personaSwitchRing)"
              strokeWidth="1"
              opacity={0.35}
            />
          </Box>
        </Box>

        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            animation: `${pulseRing} 2.2s ease-in-out infinite`,
            width: 112,
            height: 112,
            borderRadius: '28%',
            background:
              'linear-gradient(145deg, rgba(147,197,253,0.25), rgba(74,222,128,0.2), rgba(251,146,60,0.2))',
            border: '2px solid rgba(255,255,255,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="svg"
            viewBox="0 0 64 64"
            sx={{
              width: 56,
              height: 56,
              animation: `${bob} 1.8s ease-in-out infinite`,
            }}
            aria-hidden
          >
            <path
              d="M32 8 L52 22 L52 42 L32 56 L12 42 L12 22 Z"
              fill="none"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="28" r="6" fill="rgba(255,255,255,0.9)" />
            <path
              d="M20 44 Q32 38 44 44"
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Box>
        </Box>

        <Box
          sx={{
            position: 'absolute',
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: '#93c5fd',
            top: 16,
            left: '50%',
            ml: '-6px',
            animation: `${bob} 1.4s ease-in-out infinite`,
            animationDelay: '0.15s',
            boxShadow: '0 0 12px rgba(147,197,253,0.8)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: '#4ade80',
            bottom: 28,
            right: 24,
            animation: `${bob} 1.6s ease-in-out infinite`,
            animationDelay: '0.35s',
            boxShadow: '0 0 10px rgba(74,222,128,0.75)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: '#fb923c',
            bottom: 32,
            left: 20,
            animation: `${bob} 1.5s ease-in-out infinite`,
            animationDelay: '0.5s',
            boxShadow: '0 0 10px rgba(251,146,60,0.75)',
          }}
        />
      </Box>

      <Typography
        variant="h6"
        component="p"
        align="center"
        sx={{ color: 'common.white', fontWeight: 600, maxWidth: 320 }}
      >
        {t('persona.switchingTitle', 'Switching workspace')}
      </Typography>
      <Typography
        variant="body2"
        align="center"
        sx={{ color: 'rgba(255,255,255,0.8)', maxWidth: 320 }}
      >
        {t('persona.switchingSubtitle', 'Opening {{label}}…', {
          label: targetLabel,
        })}
      </Typography>
    </Backdrop>
  );
};

export default PersonaSwitchOverlay;
