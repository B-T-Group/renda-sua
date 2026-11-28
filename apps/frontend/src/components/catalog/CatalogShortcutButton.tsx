import { Box, Typography } from '@mui/material';
import { useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const BUTTON_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 44,
  minHeight: 44,
  maxWidth: 88,
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  color: 'primary.main',
  flexShrink: 0,
  '&:hover': { opacity: 0.85 },
} as const;

const CAPTION_SX = {
  mt: 0.25,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1.2,
  maxWidth: 84,
  textAlign: 'center',
  color: 'primary.main',
} as const;

/** Icon-and-caption jump, matching the My rentals control on the rentals catalog. */
export function CatalogShortcutButton({
  label,
  to,
  icon,
  testId,
}: {
  label: string;
  to: string;
  icon: ReactNode;
  testId: string;
}) {
  const navigate = useNavigate();
  const onClick = useCallback(() => navigate(to), [navigate, to]);

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      sx={BUTTON_SX}
    >
      <Box sx={{ lineHeight: 0 }}>{icon}</Box>
      <Typography component="span" sx={CAPTION_SX}>
        {label}
      </Typography>
    </Box>
  );
}
