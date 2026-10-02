import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessOrderTiming } from '../../hooks/useBusinessOrderTiming';

function secondsToMinutes(sec: number): string {
  return String(Math.max(1, Math.round(sec / 60)));
}

const BusinessOrderTimingCard: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { timing, loading, saving, updateTiming } = useBusinessOrderTiming();
  const [asapMins, setAsapMins] = useState('5');
  const [futureMins, setFutureMins] = useState('15');
  const [leadMins, setLeadMins] = useState(30);
  const [prepMins, setPrepMins] = useState('25');

  useEffect(() => {
    if (!timing) return;
    setAsapMins(secondsToMinutes(timing.effective.acceptance_timeout_seconds));
    setFutureMins(
      secondsToMinutes(timing.effective.future_acceptance_timeout_seconds)
    );
    setLeadMins(timing.effective.order_activation_lead_minutes);
    setPrepMins(String(timing.effective.default_estimated_prep_minutes));
  }, [timing]);

  const handleSave = async () => {
    const asapSec = Math.round(Number(asapMins) * 60);
    const futureSec = Math.round(Number(futureMins) * 60);
    const prep = Number(prepMins);
    if (!Number.isFinite(asapSec) || !Number.isFinite(futureSec) || !Number.isFinite(prep)) {
      enqueueSnackbar(
        t('businessOrderTiming.invalid', 'Enter valid timing values.'),
        { variant: 'error' }
      );
      return;
    }
    try {
      await updateTiming({
        acceptance_timeout_seconds: asapSec,
        future_acceptance_timeout_seconds: futureSec,
        order_activation_lead_minutes: leadMins,
        default_estimated_prep_minutes: Math.round(prep),
      });
      enqueueSnackbar(
        t('businessOrderTiming.saved', 'Timing settings saved.'),
        { variant: 'success' }
      );
    } catch (err: any) {
      enqueueSnackbar(
        err?.message ||
          t('businessOrderTiming.saveFailed', 'Could not save timing.'),
        { variant: 'error' }
      );
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">
            {t('businessOrderTiming.title', 'Order confirmation timing')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.locations.allLocations.timingHelp',
              'These settings apply to all your locations.'
            )}
          </Typography>
        </Box>

        {!timing && loading ? (
          <Alert severity="info">
            {t('common.loading', 'Loading...')}
          </Alert>
        ) : null}

        <TextField
          label={t(
            'business.locations.allLocations.asapLabel',
            'How long you have to confirm an order'
          )}
          helperText={t(
            'business.locations.allLocations.asapHelp',
            "If you don't confirm in this time, the order is declined."
          )}
          type="number"
          value={asapMins}
          onChange={(e) => setAsapMins(e.target.value)}
          disabled={loading || saving}
          inputProps={{ min: 1, max: 60 }}
          fullWidth
        />
        <TextField
          label={t(
            'business.locations.allLocations.futureLabel',
            'How long you have to confirm a scheduled order'
          )}
          type="number"
          value={futureMins}
          onChange={(e) => setFutureMins(e.target.value)}
          disabled={loading || saving}
          inputProps={{ min: 1, max: 60 }}
          fullWidth
        />
        <FormControl fullWidth disabled={loading || saving}>
          <InputLabel id="activation-lead-label">
            {t(
              'business.locations.allLocations.leadLabel',
              'Start counting before prep time'
            )}
          </InputLabel>
          <Select
            labelId="activation-lead-label"
            label={t(
              'business.locations.allLocations.leadLabel',
              'Start counting before prep time'
            )}
            value={leadMins}
            onChange={(e) => setLeadMins(Number(e.target.value))}
          >
            {(timing?.activation_lead_choices || [30, 60, 120]).map((mins) => (
              <MenuItem key={mins} value={mins}>
                {t('businessOrderTiming.leadOption', '{{mins}} min', { mins })}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          {t(
            'business.locations.allLocations.leadHelp',
            'For scheduled orders, the confirm timer starts this long before you need to start preparing.'
          )}
        </Typography>
        <TextField
          label={t(
            'business.locations.allLocations.prepLabel',
            'Usual preparation time (minutes)'
          )}
          helperText={t(
            'business.locations.allLocations.prepHelp',
            'Used to tell customers when to expect their order.'
          )}
          type="number"
          value={prepMins}
          onChange={(e) => setPrepMins(e.target.value)}
          disabled={loading || saving}
          inputProps={{ min: 5, max: 240 }}
          fullWidth
        />
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={loading || saving}
        >
          {t('common.save', 'Save')}
        </Button>
      </Stack>
    </Paper>
  );
};

export default BusinessOrderTimingCard;
