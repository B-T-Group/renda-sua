import { EventAvailableOutlined } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useClientFlags } from '../../hooks/useClientFlags';
import { useClientRentalsTabBadge } from '../../hooks/useClientRentalsTabBadge';
import { myRentalsEntrySegment } from '../../utils/myRentalsTodoCount';

/** In-page My rentals control for the /rentals hero. Reuses the tab badge count. */
export function MyRentalsHeroEntry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flags } = useClientFlags();
  const { isAuthenticated } = useSessionAuth();
  const enabled = flags.rentals_my_rentals_entry_enabled === true;
  const todo = useClientRentalsTabBadge(enabled && isAuthenticated);
  const label = t('rentals.hub.title', 'My rentals');
  const count = isAuthenticated ? todo.count : 0;
  const badge = isAuthenticated ? todo.badge : null;
  const accessibilityLabel =
    count > 0
      ? t('rentals.hub.titleCount', 'My rentals, {{count}} to do', { count })
      : label;

  const onClick = useCallback(() => {
    navigate(`/rentals/requests?segment=${myRentalsEntrySegment(count)}`);
  }, [count, navigate]);

  if (!enabled) return null;

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={accessibilityLabel}
      data-testid="rental-my-rentals-entry"
      sx={{
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
      }}
    >
      <Box sx={{ position: 'relative', lineHeight: 0 }}>
        <EventAvailableOutlined sx={{ fontSize: 22, color: 'primary.main' }} />
        {badge ? (
          <Box
            data-testid="rental-my-rentals-badge"
            aria-hidden
            sx={{
              position: 'absolute',
              top: -4,
              right: -10,
              minWidth: 16,
              height: 16,
              px: '3px',
              borderRadius: '8px',
              bgcolor: 'primary.main',
              color: '#ffffff',
              border: '1.5px solid',
              borderColor: 'grey.100',
              fontSize: 9,
              fontWeight: 800,
              lineHeight: '13px',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            {badge}
          </Box>
        ) : null}
      </Box>
      <Typography
        component="span"
        sx={{
          mt: 0.25,
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.2,
          maxWidth: 84,
          textAlign: 'center',
          color: 'primary.main',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default MyRentalsHeroEntry;
