import { Box, LinearProgress, Typography, useMediaQuery } from '@mui/material';
import { keyframes, styled, useTheme } from '@mui/material/styles';
import Lottie from 'lottie-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PERSONA_HEADER_COLORS,
  type PersonaSlug,
} from '../../constants/personaTheme';
import type { DashboardComposingPersona } from '../../hooks/useDashboardComposingSession';
import { PersonaPickIllustration } from '../onboarding/PersonaPickIllustration';
import agentAnim from '../../assets/animations/dashboard-agent.json';
import businessAnim from '../../assets/animations/dashboard-business.json';
import clientAnim from '../../assets/animations/dashboard-client.json';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const subtitleFade = keyframes`
  0%, 12% { opacity: 0; transform: translateY(6px); }
  20%, 80% { opacity: 1; transform: translateY(0); }
  88%, 100% { opacity: 0; transform: translateY(-4px); }
`;

const Root = styled(Box)(({ theme }) => ({
  position: 'fixed',
  inset: 0,
  zIndex: theme.zIndex.modal + 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(3),
  animation: `${fadeIn} 0.28s ease-out`,
}));

const Content = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: 360,
  width: '100%',
  gap: 16,
});

type CopyKey = {
  headline: string;
  headlineDefault: string;
  lines: Array<{ key: string; fallback: string }>;
};

const COPY: Record<DashboardComposingPersona, CopyKey> = {
  client: {
    headline: 'dashboardComposing.client.headline',
    headlineDefault: 'Building your personalized dashboard',
    lines: [
      {
        key: 'dashboardComposing.client.line1',
        fallback: 'Finding shops near you',
      },
      {
        key: 'dashboardComposing.client.line2',
        fallback: 'Preparing today’s picks',
      },
      {
        key: 'dashboardComposing.client.line3',
        fallback: 'Almost ready',
      },
    ],
  },
  agent: {
    headline: 'dashboardComposing.agent.headline',
    headlineDefault: 'Preparing your delivery board',
    lines: [
      {
        key: 'dashboardComposing.agent.line1',
        fallback: 'Checking nearby orders',
      },
      {
        key: 'dashboardComposing.agent.line2',
        fallback: 'Getting your routes ready',
      },
      {
        key: 'dashboardComposing.agent.line3',
        fallback: 'Almost ready',
      },
    ],
  },
  business: {
    headline: 'dashboardComposing.business.headline',
    headlineDefault: 'Setting up your store',
    lines: [
      {
        key: 'dashboardComposing.business.line1',
        fallback: 'Gathering today’s orders',
      },
      {
        key: 'dashboardComposing.business.line2',
        fallback: 'Arranging your dashboard',
      },
      {
        key: 'dashboardComposing.business.line3',
        fallback: 'Almost ready',
      },
    ],
  },
  delegate: {
    headline: 'dashboardComposing.delegate.headline',
    headlineDefault: 'Opening this location',
    lines: [
      {
        key: 'dashboardComposing.delegate.line1',
        fallback: 'Loading orders and inventory',
      },
      {
        key: 'dashboardComposing.delegate.line2',
        fallback: 'Almost ready',
      },
    ],
  },
};

const LOTTIE_BY_PERSONA: Record<
  DashboardComposingPersona,
  object
> = {
  client: clientAnim,
  agent: agentAnim,
  business: businessAnim,
  delegate: businessAnim,
};

function accentFor(persona: DashboardComposingPersona): string {
  if (persona === 'delegate') {
    return PERSONA_HEADER_COLORS.business.main;
  }
  return PERSONA_HEADER_COLORS[persona as PersonaSlug].main;
}

function illustrationPersona(
  persona: DashboardComposingPersona
): PersonaSlug {
  return persona === 'delegate' ? 'business' : persona;
}

export interface DashboardComposingOverlayProps {
  persona: DashboardComposingPersona;
}

export const DashboardComposingOverlay: React.FC<
  DashboardComposingOverlayProps
> = ({ persona }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const copy = COPY[persona];
  const accent = accentFor(persona);
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion || copy.lines.length <= 1) return;
    const id = setInterval(() => {
      setLineIndex((i) => (i + 1) % copy.lines.length);
    }, 2000);
    return () => clearInterval(id);
  }, [copy.lines.length, reduceMotion]);

  const line = copy.lines[lineIndex] ?? copy.lines[0];
  const wash = useMemo(() => `${accent}14`, [accent]);
  const lottieData = LOTTIE_BY_PERSONA[persona];

  return (
    <Root
      sx={{
        backgroundColor: theme.palette.background.default,
        backgroundImage: `radial-gradient(ellipse at 50% 38%, ${wash} 0%, transparent 62%)`,
      }}
      role="progressbar"
      aria-busy="true"
      aria-valuetext={t(copy.headline, copy.headlineDefault)}
    >
      <Content>
        <Box
          sx={{
            width: 180,
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-hidden
        >
          {reduceMotion ? (
            <PersonaPickIllustration
              persona={illustrationPersona(persona)}
              accent={accent}
            />
          ) : (
            <Lottie
              animationData={lottieData}
              loop
              style={{ width: 180, height: 180 }}
            />
          )}
        </Box>

        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.35 }}
        >
          {t(copy.headline, copy.headlineDefault)}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          aria-live="polite"
          key={line.key}
          sx={
            reduceMotion
              ? undefined
              : {
                  animation: `${subtitleFade} 2s ease-in-out`,
                  minHeight: 24,
                }
          }
        >
          {t(line.key, line.fallback)}
        </Typography>

        <LinearProgress
          variant="indeterminate"
          sx={{
            width: '56%',
            maxWidth: 200,
            height: 3,
            borderRadius: 2,
            mt: 1,
            bgcolor: `${accent}22`,
            '& .MuiLinearProgress-bar': { bgcolor: accent },
          }}
        />
      </Content>
    </Root>
  );
};

export default DashboardComposingOverlay;
