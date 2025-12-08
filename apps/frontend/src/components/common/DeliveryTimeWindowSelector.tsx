import {
  AccessTime,
  CalendarToday,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DeliveryTimeSlot,
  useDeliveryTimeSlots,
} from '../../hooks/useDeliveryTimeSlots';

export interface DeliveryWindowData {
  slot_id: string;
  preferred_date: string;
  special_instructions?: string;
}

interface DeliveryTimeWindowSelectorProps {
  countryCode: string;
  stateCode?: string;
  value: DeliveryWindowData | null;
  onChange: (data: DeliveryWindowData | null) => void;
  isFastDelivery?: boolean;
  disabled?: boolean;
}

const DeliveryTimeWindowSelector: React.FC<DeliveryTimeWindowSelectorProps> = ({
  countryCode,
  stateCode,
  value,
  onChange,
  isFastDelivery = false,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value?.preferred_date ? new Date(value.preferred_date) : null
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string>(
    value?.slot_id || ''
  );
  const [specialInstructions, setSpecialInstructions] = useState<string>(
    value?.special_instructions || ''
  );

  // Calculate maximum date (30 days from now)
  const maxDate = useMemo(() => {
    const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    date.setHours(23, 59, 59, 999);
    return date;
  }, []);

  const {
    slots,
    loading: slotsLoading,
    error: slotsError,
  } = useDeliveryTimeSlots(
    countryCode,
    stateCode,
    selectedDate?.toISOString().split('T')[0],
    isFastDelivery
  );

  // Memoize value properties for stable comparison
  const valueDate = useMemo(
    () => value?.preferred_date || null,
    [value?.preferred_date]
  );
  const valueSlotId = useMemo(() => value?.slot_id || null, [value?.slot_id]);
  const valueInstructions = useMemo(
    () => value?.special_instructions,
    [value?.special_instructions]
  );

  // Sync internal state when value prop changes
  useEffect(() => {
    if (value) {
      if (valueDate) {
        const newDate = new Date(valueDate);
        const currentDateStr = selectedDate?.toISOString().split('T')[0];
        if (currentDateStr !== valueDate) {
          setSelectedDate(newDate);
        }
      } else if (selectedDate) {
        setSelectedDate(null);
      }

      if (valueSlotId && valueSlotId !== selectedSlotId) {
        setSelectedSlotId(valueSlotId);
      } else if (!valueSlotId && selectedSlotId) {
        setSelectedSlotId('');
      }

      if (
        valueInstructions !== undefined &&
        valueInstructions !== specialInstructions
      ) {
        setSpecialInstructions(valueInstructions || '');
      }
    } else {
      if (selectedDate || selectedSlotId) {
        setSelectedDate(null);
        setSelectedSlotId('');
      }
    }
  }, [
    valueDate,
    valueSlotId,
    valueInstructions,
    selectedDate,
    selectedSlotId,
    specialInstructions,
    value,
  ]);

  // Update parent component when form values change
  useEffect(() => {
    if (selectedDate && selectedSlotId) {
      onChange({
        slot_id: selectedSlotId,
        preferred_date: selectedDate.toISOString().split('T')[0],
        special_instructions: specialInstructions || undefined,
      });
    } else {
      onChange(null);
    }
  }, [selectedDate, selectedSlotId, specialInstructions, onChange]);

  const handleDateChange = useCallback((date: Date | null) => {
    setSelectedDate(date);
    // Reset slot selection when date changes
    setSelectedSlotId('');
  }, []);

  const handleSlotChange = useCallback((slotId: string) => {
    setSelectedSlotId(slotId);
  }, []);

  const formatTimeSlot = useCallback((slot: DeliveryTimeSlot | undefined) => {
    if (!slot) return '';
    return `${slot.slot_name} (${slot.start_time} - ${slot.end_time})`;
  }, []);

  const getSlotAvailabilityColor = useCallback((slot: DeliveryTimeSlot) => {
    if (!slot.is_available) return 'error';
    if (slot.available_capacity <= 2) return 'warning';
    return 'success';
  }, []);

  const getSlotAvailabilityText = useCallback(
    (slot: DeliveryTimeSlot) => {
      if (!slot.is_available)
        return t('orders.deliveryTimeWindow.unavailable', 'Unavailable');
      if (slot.available_capacity <= 2)
        return t('orders.deliveryTimeWindow.limited', 'Limited spots');
      return t('orders.deliveryTimeWindow.available', 'Available');
    },
    [t]
  );

  // Helper function to check if a time slot is valid (not passed and at least 2 hours in the future)
  const isTimeSlotValid = useCallback(
    (slot: DeliveryTimeSlot) => {
      if (!selectedDate) return true;

      const today = new Date();
      const selectedDateOnly = new Date(selectedDate);

      // Check if the selected date is today
      const isToday = selectedDateOnly.toDateString() === today.toDateString();

      // For future dates, all slots are valid
      if (!isToday) return true;

      // Parse the slot start time (assuming format like "09:00" or "9:00 AM")
      const parseTime = (timeStr: string): Date => {
        const time = timeStr.replace(/\s*(AM|PM)/i, '').trim();
        const [hours, minutes] = time.split(':').map(Number);

        // Handle 12-hour format
        let hour24 = hours;
        if (timeStr.toLowerCase().includes('pm') && hours !== 12) {
          hour24 = hours + 12;
        } else if (timeStr.toLowerCase().includes('am') && hours === 12) {
          hour24 = 0;
        }

        const slotTime = new Date(today);
        slotTime.setHours(hour24, minutes || 0, 0, 0);
        return slotTime;
      };

      try {
        const slotStartTime = parseTime(slot.start_time);
        const currentTime = new Date();

        // Check if slot is in the past
        if (slotStartTime <= currentTime) {
          return false;
        }

        // Check if slot is at least 2 hours in the future
        const twoHoursFromNow = new Date(
          currentTime.getTime() + 2 * 60 * 60 * 1000
        );
        return slotStartTime >= twoHoursFromNow;
      } catch (error) {
        console.warn('Failed to parse time slot:', slot.start_time, error);
        return false;
      }
    },
    [selectedDate]
  );

  // Filter slots to exclude invalid time slots (passed or within 2 hours)
  const filteredSlots = useMemo(() => {
    if (!selectedDate) return slots;

    return slots.filter((slot) => isTimeSlotValid(slot));
  }, [slots, selectedDate, isTimeSlotValid]);

  if (disabled) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          {t(
            'orders.deliveryTimeWindow.disabled',
            'Delivery time selection is disabled'
          )}
        </Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Stack spacing={3}>
        {/* Date Selection */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            {t(
              'orders.deliveryTimeWindow.preferredDate',
              'Preferred delivery date'
            )}
          </Typography>
          <DatePicker
            value={selectedDate}
            onChange={handleDateChange}
            maxDate={maxDate}
            disabled={disabled}
            slotProps={{
              textField: {
                fullWidth: true,
                variant: 'outlined',
                placeholder: t(
                  'orders.deliveryTimeWindow.selectDate',
                  'Select a date'
                ),
              },
            }}
          />
        </Box>

        {/* Time Slot Selection */}
        {selectedDate && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              {t('orders.deliveryTimeWindow.selectSlot', 'Select a time slot')}
            </Typography>

            {slotsLoading ? (
              <Stack spacing={2}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rectangular" height={80} />
                ))}
              </Stack>
            ) : slotsError ? (
              <Alert severity="error" icon={<ErrorIcon />}>
                {slotsError}
              </Alert>
            ) : slots.length === 0 ? (
              <Alert severity="info">
                {t(
                  'orders.deliveryTimeWindow.noSlotsAvailable',
                  'No delivery slots available for this date'
                )}
              </Alert>
            ) : filteredSlots.length === 0 ? (
              <Alert severity="info">
                {t(
                  'orders.deliveryTimeWindow.noSlotsAvailableToday',
                  'No delivery slots available for the rest of today'
                )}
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {filteredSlots.map((slot) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={slot.id}>
                    <Card
                      sx={{
                        cursor: slot.is_available ? 'pointer' : 'not-allowed',
                        opacity: slot.is_available ? 1 : 0.6,
                        border: selectedSlotId === slot.id ? 2 : 1,
                        borderColor:
                          selectedSlotId === slot.id
                            ? 'primary.main'
                            : 'divider',
                        '&:hover': slot.is_available
                          ? {
                              boxShadow: 2,
                            }
                          : {},
                      }}
                      onClick={() =>
                        slot.is_available && handleSlotChange(slot.id)
                      }
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Stack spacing={1}>
                          <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Typography variant="subtitle2" fontWeight="bold">
                              {slot.slot_name}
                            </Typography>
                            <Chip
                              label={getSlotAvailabilityText(slot)}
                              color={getSlotAvailabilityColor(slot)}
                              size="small"
                            />
                          </Box>

                          <Box display="flex" alignItems="center">
                            <AccessTime
                              sx={{
                                mr: 1,
                                fontSize: 16,
                                color: 'text.secondary',
                              }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {slot.start_time} - {slot.end_time}
                            </Typography>
                          </Box>

                          {slot.is_available && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {t('orders.deliveryTimeWindow.capacity', {
                                available: slot.available_capacity,
                                defaultValue: `${slot.available_capacity} spots available`,
                              })}
                            </Typography>
                          )}

                          {selectedSlotId === slot.id && (
                            <Box
                              display="flex"
                              alignItems="center"
                              color="primary.main"
                            >
                              <CheckCircle sx={{ mr: 0.5, fontSize: 16 }} />
                              <Typography variant="caption" fontWeight="medium">
                                {t(
                                  'orders.deliveryTimeWindow.selected',
                                  'Selected'
                                )}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        {/* Special Instructions */}
        {selectedDate && selectedSlotId && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              {t(
                'orders.deliveryTimeWindow.specialInstructions',
                'Special delivery instructions'
              )}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              placeholder={t(
                'orders.deliveryTimeWindow.instructionsPlaceholder',
                'Any special instructions for delivery...'
              )}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              disabled={disabled}
            />
          </Box>
        )}

        {/* Summary */}
        {selectedDate && selectedSlotId && (
          <Card
            sx={{
              bgcolor: 'primary.50',
              border: 1,
              borderColor: 'primary.200',
            }}
          >
            <CardContent>
              <Typography variant="subtitle2" gutterBottom color="primary">
                {t('orders.deliveryTimeWindow.summary', 'Delivery Summary')}
              </Typography>
              <Stack spacing={1}>
                <Box display="flex" alignItems="center">
                  <CalendarToday
                    sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }}
                  />
                  <Typography variant="body2">
                    {selectedDate.toLocaleDateString()}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <Schedule
                    sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }}
                  />
                  <Typography variant="body2">
                    {formatTimeSlot(
                      filteredSlots.find((s) => s.id === selectedSlotId)
                    )}
                  </Typography>
                </Box>
                {specialInstructions && (
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'orders.deliveryTimeWindow.withInstructions',
                      'With special instructions'
                    )}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </LocalizationProvider>
  );
};

export default DeliveryTimeWindowSelector;
