import { AccessTime, CheckCircle } from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DedicatedCoveredSlot,
  isCoveredDeliveryWindow,
} from '../../utils/checkoutPresentation';
import type { DeliveryWindowData } from './DeliveryTimeWindowSelector';

export interface CoveredDeliverySlotPickerProps {
  /** Covered (date, slot) pairs from the preflight, cart-level for multi-seller carts. */
  slots: DedicatedCoveredSlot[];
  value: DeliveryWindowData | null;
  onChange: (data: DeliveryWindowData | null) => void;
  disabled?: boolean;
}

const SLOT_KEY_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

function formatDate(date: string, locale: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * #594: when no agent is nearby for ASAP delivery but a dedicated agent covers
 * some scheduled slots, delivery is scheduled-only and only those slots are offered.
 */
const CoveredDeliverySlotPicker: React.FC<CoveredDeliverySlotPickerProps> = ({
  slots,
  value,
  onChange,
  disabled = false,
}) => {
  const { t, i18n } = useTranslation();

  const byDate = useMemo(() => {
    const map = new Map<string, DedicatedCoveredSlot[]>();
    for (const slot of slots) {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    }
    return [...map.entries()];
  }, [slots]);

  // Keep the selection inside the covered set; default to the earliest covered slot.
  useEffect(() => {
    if (isCoveredDeliveryWindow(value, slots)) return;
    const first = slots[0];
    onChange(first ? { slot_id: first.slot_id, preferred_date: first.date } : null);
  }, [slots, value, onChange]);

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        {t(
          'orders.deliveryTimeWindow.dedicatedScheduledOnly',
          'Scheduled delivery only for this store right now. Choose one of the times below.'
        )}
      </Alert>
      {byDate.map(([date, dateSlots]) => (
        <Box key={date}>
          <Typography variant="subtitle1" gutterBottom>
            {formatDate(date, i18n.language || 'en')}
          </Typography>
          <Grid container spacing={2}>
            {dateSlots.map((slot) => {
              const selected =
                value?.slot_id === slot.slot_id && value?.preferred_date === slot.date;
              const name = slot.slot_key
                ? t(
                    `orders.deliveryTimeWindow.slotKey.${slot.slot_key}`,
                    SLOT_KEY_LABELS[slot.slot_key] ?? slot.slot_key
                  )
                : '';
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`${slot.date}-${slot.slot_id}`}>
                  <Card
                    data-testid={`covered-slot-${slot.date}-${slot.slot_id}`}
                    aria-pressed={selected}
                    sx={{
                      border: selected ? 2 : 1,
                      borderColor: selected ? 'primary.main' : 'divider',
                    }}
                  >
                    <CardActionArea
                      disabled={disabled}
                      onClick={() =>
                        onChange({ slot_id: slot.slot_id, preferred_date: slot.date })
                      }
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Stack spacing={1}>
                          {name ? (
                            <Typography variant="subtitle2" fontWeight="bold">
                              {name}
                            </Typography>
                          ) : null}
                          <Box display="flex" alignItems="center">
                            <AccessTime
                              sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {slot.start} - {slot.end}
                            </Typography>
                          </Box>
                          {slot.pickup_time ? (
                            <Typography variant="caption" color="text.secondary">
                              {t('orders.deliveryTimeWindow.dedicatedPickupAt', {
                                time: slot.pickup_time,
                                defaultValue: `Picked up from the store at ${slot.pickup_time}`,
                              })}
                            </Typography>
                          ) : null}
                          {selected ? (
                            <Box display="flex" alignItems="center" color="primary.main">
                              <CheckCircle sx={{ mr: 0.5, fontSize: 16 }} />
                              <Typography variant="caption" fontWeight="medium">
                                {t('orders.deliveryTimeWindow.selected', 'Selected')}
                              </Typography>
                            </Box>
                          ) : null}
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ))}
    </Stack>
  );
};

export default CoveredDeliverySlotPicker;
