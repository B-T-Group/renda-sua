import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FOOD_WEEKDAY_INDEXES } from '../../../constants/food';
import { useFoodWeekdayNames } from '../../../hooks/useFoodWeekdayNames';
import type { FoodAvailabilitySlot } from '../../../types/food';
import { formatSlotTime, isOvernightSlot } from '../../../utils/foodAvailability';

const DEFAULT_START = '12:00';
const DEFAULT_END = '15:00';

interface FoodAvailabilityEditorProps {
  slots: FoodAvailabilitySlot[];
  onChange: (slots: FoodAvailabilitySlot[]) => void;
  disabled?: boolean;
}

/**
 * Weekly serving hours for a dish. One row per window, grouped by day, so a
 * merchant can set "Monday 12:30 to 16:00" without a wizard. Leaving every day
 * empty keeps the dish on the menu at all times.
 */
const FoodAvailabilityEditor: React.FC<FoodAvailabilityEditorProps> = ({
  slots,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const weekdayNames = useFoodWeekdayNames();

  const slotsForDay = useCallback(
    (day: number) => slots.filter((slot) => slot.day_of_week === day),
    [slots]
  );

  const addSlot = useCallback(
    (day: number) => {
      onChange([
        ...slots,
        {
          day_of_week: day,
          start_time: DEFAULT_START,
          end_time: DEFAULT_END,
        },
      ]);
    },
    [onChange, slots]
  );

  const updateSlot = useCallback(
    (target: FoodAvailabilitySlot, patch: Partial<FoodAvailabilitySlot>) => {
      onChange(
        slots.map((slot) => (slot === target ? { ...slot, ...patch } : slot))
      );
    },
    [onChange, slots]
  );

  const removeSlot = useCallback(
    (target: FoodAvailabilitySlot) => {
      onChange(slots.filter((slot) => slot !== target));
    },
    [onChange, slots]
  );

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {t('business.food.servingHours', 'Serving hours')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'business.food.servingHoursHelp',
          'Set the times this dish is served. Leave every day empty to keep it on the menu at all times.'
        )}
      </Typography>

      <Stack spacing={1.5}>
        {FOOD_WEEKDAY_INDEXES.map((day) => {
          const daySlots = slotsForDay(day);
          return (
            <Box key={day}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {weekdayNames[day]}
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addSlot(day)}
                  disabled={disabled}
                >
                  {t('business.food.addWindow', 'Add hours')}
                </Button>
              </Box>

              {daySlots.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  {t('business.food.notServed', 'Not served')}
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ mt: 0.5 }}>
                  {daySlots.map((slot, index) => (
                    <Box
                      key={`${day}-${index}`}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <TextField
                        type="time"
                        size="small"
                        label={t('business.food.from', 'From')}
                        value={formatSlotTime(slot.start_time)}
                        onChange={(event) =>
                          updateSlot(slot, { start_time: event.target.value })
                        }
                        disabled={disabled}
                        sx={{ maxWidth: 140 }}
                      />
                      <TextField
                        type="time"
                        size="small"
                        label={t('business.food.to', 'To')}
                        value={formatSlotTime(slot.end_time)}
                        onChange={(event) =>
                          updateSlot(slot, { end_time: event.target.value })
                        }
                        disabled={disabled}
                        sx={{ maxWidth: 140 }}
                      />
                      {isOvernightSlot(slot) && (
                        <Typography variant="caption" color="text.secondary">
                          {t('business.food.nextDay', 'next day')}
                        </Typography>
                      )}
                      <Tooltip
                        title={t('business.food.removeWindow', 'Remove hours')}
                      >
                        <IconButton
                          size="small"
                          onClick={() => removeSlot(slot)}
                          disabled={disabled}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          );
        })}
      </Stack>

      {slots.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t(
            'business.food.noHoursSet',
            'No hours set, so this dish can be ordered at any time.'
          )}
        </Alert>
      )}
    </Box>
  );
};

export default FoodAvailabilityEditor;
