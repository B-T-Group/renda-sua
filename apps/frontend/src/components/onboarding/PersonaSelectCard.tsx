import { Box, CircularProgress, Typography } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import React from 'react';
import type { PersonaSlug } from '../../constants/personaTheme';
import { PersonaPickIllustration } from './PersonaPickIllustration';

/** Taller tiles for one or two choices; shorter when three must share one screen. */
const CARD_HEIGHT = {
  regular: { xs: 328, sm: 344 },
  compact: { xs: 156, sm: 176 },
} as const;

const shimmer = keyframes`
  0% { opacity: 0.45; }
  50% { opacity: 0.85; }
  100% { opacity: 0.45; }
`;

export interface PersonaSelectCardProps {
  persona: PersonaSlug;
  accent: string;
  title: string;
  tagline: string;
  ctaText: string;
  busy: boolean;
  isSelecting: boolean;
  onSelect: () => void;
  /** Shorter tile so three personas fit on one screen. */
  compact?: boolean;
}

export const PersonaSelectCard: React.FC<PersonaSelectCardProps> = ({
  persona,
  accent,
  title,
  tagline,
  ctaText,
  busy,
  isSelecting,
  onSelect,
  compact = false,
}) => {
  const cardHeight = compact ? CARD_HEIGHT.compact : CARD_HEIGHT.regular;
  const artHeight = compact ? 56 : 148;
  return (
  <Box
    component="button"
    type="button"
    disabled={busy}
    onClick={onSelect}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!busy) onSelect();
      }
    }}
    aria-label={title}
    sx={{
      width: '100%',
      height: '100%',
      minHeight: cardHeight,
      textAlign: 'center',
      cursor: busy ? 'default' : 'pointer',
      border: 'none',
      p: 0,
      display: 'flex',
      WebkitTapHighlightColor: 'transparent',
      background: 'transparent',
      borderRadius: 0,
      '&:disabled': { opacity: busy && !isSelecting ? 0.55 : 1 },
    }}
  >
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        width: '100%',
        height: cardHeight,
        flexShrink: 0,
        p: compact ? { xs: 1, sm: 1.25 } : { xs: 1.5, sm: 1.75 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '1.5px solid',
        borderColor: alpha(accent, 0.35),
        bgcolor: alpha(accent, 0.06),
        borderRadius: '8px',
        transition:
          'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
        boxShadow: (theme) => `0 6px 20px ${alpha(theme.palette.common.black, 0.06)}`,
        '@media (hover: hover)': {
          '&:hover': {
            borderColor: accent,
            bgcolor: alpha(accent, 0.1),
            transform: busy ? 'none' : 'translateY(-2px)',
            boxShadow: (theme) => `0 12px 28px ${alpha(accent, 0.14)}`,
          },
        },
        '&:focus-visible': {
          outline: `3px solid ${accent}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -28,
          right: -28,
          width: 88,
          height: 88,
          borderRadius: '50%',
          bgcolor: alpha(accent, 0.1),
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -18,
          left: -18,
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: alpha(accent, 0.07),
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          width: compact ? 72 : 160,
          height: artHeight,
          mx: 'auto',
          mb: compact ? 0.25 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PersonaPickIllustration
          persona={persona}
          accent={accent}
          height={artHeight}
        />
      </Box>

      <Typography
        component="h2"
        sx={{
          position: 'relative',
          fontWeight: 800,
          color: accent,
          letterSpacing: '-0.02em',
          fontSize: compact
            ? { xs: '1.05rem', sm: '1.15rem' }
            : { xs: '1.45rem', sm: '1.6rem' },
          lineHeight: 1.15,
          mb: compact ? 0 : 0.5,
          textAlign: 'center',
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          position: 'relative',
          textAlign: 'center',
          lineHeight: 1.3,
          fontSize: compact ? '0.75rem' : undefined,
          px: 0.5,
          mb: compact ? 0.25 : 1,
        }}
      >
        {tagline}
      </Typography>

      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          width: '100%',
          minHeight: compact ? 28 : 40,
          mt: 'auto',
          pt: compact ? 0.5 : 0.75,
          borderTop: '1px solid',
          borderColor: alpha(accent, 0.2),
        }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{
            color: accent,
            letterSpacing: '0.04em',
            fontSize: compact
              ? { xs: '0.65rem', sm: '0.7rem' }
              : { xs: '0.75rem', sm: '0.8rem' },
            lineHeight: 1.3,
            textAlign: 'center',
          }}
        >
          {ctaText}
        </Typography>
        {isSelecting ? (
          <CircularProgress size={20} sx={{ color: accent, flexShrink: 0 }} />
        ) : (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: accent,
              opacity: 0.85,
              flexShrink: 0,
              animation: `${shimmer} 1.6s ease-in-out infinite`,
            }}
          />
        )}
      </Box>
    </Box>
  </Box>
  );
};
