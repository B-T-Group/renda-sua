import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import { Box, Paper, Stack, Switch, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface RentalModes {
  offersDaily: boolean;
  offersHourly: boolean;
}

/** "Rent by the day" / "Rent by the hour" (rentals_day_hours_picker_enabled). At least one stays on. */
export const RentalModeSwitches: React.FC<{ value: RentalModes; onChange: (next: RentalModes) => void; disabled?: boolean }> = ({
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();
  const row = (key: keyof RentalModes, icon: React.ReactNode, title: string, hint: string) => {
    const on = value[key];
    const lastOn = on && Object.values(value).filter(Boolean).length === 1;
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
          disabled={disabled || lastOn}
          onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
        />
      </Stack>
    );
  };
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 0.5, borderRadius: 2 }}>
      {row('offersDaily', <WbSunnyOutlinedIcon />, t('business.rentals.rentBy.byDay', 'Rent by the day'), t('business.rentals.rentBy.byDayHint', 'Renters can book a full day.'))}
      {row('offersHourly', <AccessTimeIcon />, t('business.rentals.rentBy.byHour', 'Rent by the hour'), t('business.rentals.rentBy.byHourHint', 'Renters can book a few hours.'))}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ pb: 1 }}>
        {t('business.rentals.rentBy.atLeastOne', 'Keep at least one on.')}
      </Typography>
    </Paper>
  );
};
