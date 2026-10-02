import {
  Button,
  Collapse,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useBusinessAvailability,
  type PauseDuration,
} from '../../../hooks/useBusinessAvailability';
import BusinessOrderTimingCard from '../BusinessOrderTimingCard';

const PAUSES: PauseDuration[] = ['15m', '1h', 'until_tomorrow', 'indefinite'];

/** Business-wide timing and pause, labelled as applying to every location. */
const ForAllLocationsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Stack spacing={1.5}>
      <Button variant="text" onClick={() => setOpen((value) => !value)} sx={{ alignSelf: 'flex-start' }}>
        {t('business.locations.allLocations.link', 'For all your locations')}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.locations.allLocations.banner',
              'These settings apply to all your locations.'
            )}
          </Typography>
          <BusinessOrderTimingCard />
          <PauseOrders />
        </Stack>
      </Collapse>
    </Stack>
  );
};

function PauseOrders() {
  const { t } = useTranslation();
  const availability = useBusinessAvailability(true);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={1}>
        <Typography variant="h6">
          {t('business.locations.allLocations.pauseTitle', 'Pause orders')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'business.locations.allLocations.pauseHelp',
            "Customers can't place new orders while paused."
          )}
        </Typography>
        {availability.accepting ? (
          <Button variant="outlined" onClick={(event) => setAnchor(event.currentTarget)}>
            {t('business.insights.summary.pauseCta', 'Pause orders')}
          </Button>
        ) : (
          <Button variant="contained" onClick={() => void availability.resume()}>
            {t('businessAvailability.resume', 'Resume orders')}
          </Button>
        )}
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          {PAUSES.map((duration) => (
            <MenuItem
              key={duration}
              onClick={() => {
                setAnchor(null);
                void availability.pause(duration);
              }}
            >
              {pauseLabel(duration, t)}
            </MenuItem>
          ))}
        </Menu>
      </Stack>
    </Paper>
  );
}

function pauseLabel(
  duration: PauseDuration,
  t: (key: string, fallback: string) => string
): string {
  if (duration === '15m') return t('businessAvailability.pause.15m', '15 minutes');
  if (duration === '1h') return t('businessAvailability.pause.1h', '1 hour');
  if (duration === 'until_tomorrow') {
    return t('businessAvailability.pause.until_tomorrow', 'Until tomorrow');
  }
  return t('businessAvailability.pause.indefinite', 'Until I resume');
}

export default ForAllLocationsPanel;
