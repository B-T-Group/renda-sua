import { Box, keyframes, useTheme } from '@mui/material';
import React, { useId } from 'react';

const envelopeBob = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;

const sealPop = keyframes`
  0% { transform: scale(0.6); opacity: 0.4; }
  45% { transform: scale(1.08); opacity: 1; }
  70% { transform: scale(0.96); }
  100% { transform: scale(1); opacity: 1; }
`;

const ringPulse = keyframes`
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.85; transform: scale(1.04); }
`;

const orbitDots = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const sparkle = keyframes`
  0%, 100% { opacity: 0.2; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.15); }
`;

/**
 * Vector success illustration for post-signup “account created” (animated envelope + check).
 */
const SignupAccountCreatedAnimation: React.FC = () => {
  const theme = useTheme();
  const uid = useId().replace(/:/g, '');
  const gradId = `sac-grad-${uid}`;
  const primary = theme.palette.primary.main;
  const success = theme.palette.success.main;
  const paper = theme.palette.background.paper;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        minHeight: 200,
        py: 1,
      }}
      aria-hidden
    >
      <Box
        sx={{
          position: 'relative',
          width: 'min(100%, 220px)',
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: `2px dashed ${primary}`,
            opacity: 0.25,
            animation: `${ringPulse} 3s ease-in-out infinite`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 140,
            height: 140,
            animation: `${orbitDots} 22s linear infinite`,
          }}
        >
          {[0, 72, 144, 216, 288].map((deg, i) => (
            <Box
              key={deg}
              component="span"
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: success,
                marginLeft: -3,
                marginTop: -3,
                transform: `rotate(${deg}deg) translateY(-58px)`,
                animation: `${sparkle} ${2 + i * 0.2}s ease-in-out infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </Box>

        <Box
          component="svg"
          viewBox="0 0 200 160"
          sx={{
            width: '100%',
            maxWidth: 200,
            height: 'auto',
            display: 'block',
            animation: `${envelopeBob} 3.2s ease-in-out infinite`,
            filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.08))',
          }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={primary} stopOpacity={0.9} />
              <stop offset="100%" stopColor={primary} stopOpacity={0.55} />
            </linearGradient>
          </defs>

          <path
            d="M28 52 L100 108 L172 52 L172 118 Q172 128 162 128 L38 128 Q28 128 28 118 Z"
            fill={paper}
            stroke={primary}
            strokeWidth={2}
          />
          <path
            d="M28 52 L100 100 L172 52"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M38 58 L100 98 L162 58"
            fill="none"
            stroke={primary}
            strokeWidth={1}
            opacity={0.35}
          />
        </Box>

        <Box
          sx={{
            position: 'absolute',
            right: { xs: '12%', sm: '18%' },
            bottom: { xs: 28, sm: 32 },
            width: 52,
            height: 52,
            borderRadius: '50%',
            bgcolor: success,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 6px 20px ${theme.palette.success.main}55`,
            animation: `${sealPop} 0.9s cubic-bezier(0.34, 1.4, 0.64, 1) forwards`,
          }}
        >
          <Box
            component="svg"
            viewBox="0 0 24 24"
            sx={{
              width: 28,
              height: 28,
              color: theme.palette.getContrastText(theme.palette.success.main),
            }}
          >
            <path
              fill="currentColor"
              d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SignupAccountCreatedAnimation;
