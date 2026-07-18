import { Box, Button, TextField, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  WEEKDAY_LABELS,
  type WeeklyAvailabilitySlot,
} from './businessRentalsShared';

export interface WeeklyAvailabilityEditorProps {
  value: WeeklyAvailabilitySlot[];
  onChange: (next: WeeklyAvailabilitySlot[]) => void;
  disabled?: boolean;
  title?: string;
  hint?: string;
}

const WeeklyAvailabilityEditor: React.FC<WeeklyAvailabilityEditorProps> = ({
  value,
  onChange,
  disabled = false,
  title,
  hint,
}) => {
  const { t } = useTranslation();

  const updateSlot = (index: number, patch: Partial<WeeklyAvailabilitySlot>) => {
    onChange(value.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {title ?? t('business.rentals.weeklyAvailability', 'Weekly availability')}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {hint}
        </Typography>
      ) : null}
      {value.map((slot, index) => (
        <Box
          key={slot.weekday}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr auto' },
            gap: 1,
            mb: 1,
            alignItems: 'center',
          }}
        >
          <Typography variant="body2">{WEEKDAY_LABELS[slot.weekday]}</Typography>
          <TextField
            label={t('rentals.start', 'Start')}
            type="time"
            size="small"
            value={(slot.start_time ?? '08:00:00').slice(0, 5)}
            disabled={disabled || !slot.is_available}
            onChange={(e) =>
              updateSlot(index, { start_time: `${e.target.value}:00` })
            }
          />
          <TextField
            label={t('rentals.end', 'End')}
            type="time"
            size="small"
            value={(slot.end_time ?? '20:00:00').slice(0, 5)}
            disabled={disabled || !slot.is_available}
            onChange={(e) =>
              updateSlot(index, { end_time: `${e.target.value}:00` })
            }
          />
          <Button
            size="small"
            disabled={disabled}
            onClick={() =>
              updateSlot(index, {
                is_available: !slot.is_available,
                start_time: !slot.is_available ? '08:00:00' : null,
                end_time: !slot.is_available ? '20:00:00' : null,
              })
            }
          >
            {slot.is_available
              ? t('common.disable', 'Disable')
              : t('common.enable', 'Enable')}
          </Button>
        </Box>
      ))}
    </Box>
  );
};

export default WeeklyAvailabilityEditor;
