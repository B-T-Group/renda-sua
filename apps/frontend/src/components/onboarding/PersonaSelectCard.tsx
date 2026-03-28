import { Box, CircularProgress, Typography } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import React from 'react';
import type { PersonaSlug } from '../../constants/personaTheme';
import { PersonaPickIllustration } from './PersonaPickIllustration';

/** Fixed card height so every persona tile matches (mobile + desktop). */
const CARD_HEIGHT_PX = { xs: 200, sm: 208 };

const shimmer = keyframes`
  0% { opacity: 0.45; }
  50% { opacity: 0.85; }
  100% { opacity: 0.45; }
`;

export interface PersonaSelectCardProps {
  persona: PersonaSlug;
  accent: string;
  title: string;
  description: string;
  ctaText: string;
  busy: boolean;
  isSelecting: boolean;
  onSelect: () => void;
}

export const PersonaSelectCard: React.FC<PersonaSelectCardProps> = ({
  persona,
  accent,
  title,
  description,
  ctaText,
  busy,
  isSelecting,
  onSelect,
}) => (
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
      minHeight: CARD_HEIGHT_PX,
      textAlign: 'left',
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
        height: CARD_HEIGHT_PX,
        flexShrink: 0,
        p: { xs: 1.5, sm: 1.75 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
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

      <Box sx={{ position: 'relative', mb: 0.75, px: 0.5, maxHeight: 72 }}>
        <PersonaPickIllustration persona={persona} accent={accent} compact />
      </Box>

      <Typography
        variant="subtitle2"
        sx={{
          position: 'relative',
          fontWeight: 800,
          color: accent,
          letterSpacing: '-0.01em',
          fontSize: { xs: '0.9rem', sm: '0.95rem' },
          lineHeight: 1.25,
          mb: 0.5,
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          lineHeight: 1.45,
          fontSize: { xs: '0.75rem', sm: '0.8125rem' },
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          mb: 1,
        }}
      >
        {description}
      </Typography>

      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          minHeight: 40,
          pt: 0.75,
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
            fontSize: { xs: '0.65rem', sm: '0.7rem' },
            lineHeight: 1.3,
            textAlign: 'left',
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
