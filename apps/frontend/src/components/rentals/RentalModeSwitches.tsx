import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import { Box, Paper, Stack, Switch, Typography } from '@mui/material';
import React, { useState } from 'react';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';

/** An off switch should read as a normal unchecked switch, not a faint disabled one. */
const OFF_READS_NORMAL = {
  '& .MuiSwitch-switchBase:not(.Mui-checked):not(.Mui-disabled) + .MuiSwitch-track': { backgroundColor: '#8A94A6', opacity: 1 },
  '& .MuiSwitch-switchBase:not(.Mui-disabled) .MuiSwitch-thumb': { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.35)' },
} as const;

export interface RentalModes {
  offersDaily: boolean;
  offersHourly: boolean;
}

/** "Rent by the day" / "Rent by the hour". Switching off the last one is refused with "Keep at least one on." in red. */
export const RentalModeSwitches: React.FC<{ value: RentalModes; onChange: (next: RentalModes) => void; disabled?: boolean }> = ({
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();
  const [refused, setRefused] = useState(false);
  const row = (key: keyof RentalModes, icon: React.ReactNode, title: string, hint: string) => {
    const on = value[key];
    const lastOn = on && Object.values(value).filter(Boolean).length === 1;
    const toggle = (next: boolean) => {
      if (!next && lastOn) {
        setRefused(true);
        return;
      }
      setRefused(false);
      onChange({ ...value, [key]: next });
    };
    return (
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1 }}>
        <Box sx={{ color: '#0A4FB5', display: 'flex' }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {hint}
          </Typography>
        </Box>
        <Switch
          inputProps={{ 'aria-label': title }}
          data-testid={`rental-mode-${key}`}
          checked={on}
          disabled={disabled}
          onChange={(e) => toggle(e.target.checked)}
          sx={OFF_READS_NORMAL}
        />
      </Stack>
    );
  };
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 0.5, borderRadius: 2 }}>
      {row('offersDaily', <WbSunnyOutlinedIcon />, t('business.rentals.rentBy.byDay', 'Rent by the day'), t('business.rentals.rentBy.byDayHint', 'Renters can book a full day.'))}
      {row('offersHourly', <AccessTimeIcon />, t('business.rentals.rentBy.byHour', 'Rent by the hour'), t('business.rentals.rentBy.byHourHint', 'Renters can book a few hours.'))}
      <Stack data-testid="rental-mode-hint" direction="row" spacing={0.75} alignItems="center" sx={{ pb: 1, color: refused ? 'error.main' : 'text.secondary' }}>
        {refused ? <ErrorOutlineIcon sx={{ fontSize: 16 }} /> : <InfoOutlinedIcon sx={{ fontSize: 16 }} />}
        <Typography variant="caption" color="inherit" sx={{ fontWeight: refused ? 700 : 400 }}>
          {t('business.rentals.rentBy.atLeastOne', 'Keep at least one on.')}
        </Typography>
      </Stack>
    </Paper>
  );
};
