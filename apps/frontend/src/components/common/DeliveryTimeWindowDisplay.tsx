import {
  AccessTime,
  CalendarToday,
  CheckCircle,
  Schedule,
  Warning,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';

interface DeliveryTimeWindowDisplayProps {
  order: OrderData;
}

const DeliveryTimeWindowDisplay: React.FC<DeliveryTimeWindowDisplayProps> = ({
  order,
}) => {
  const { t } = useTranslation();

  if (
    !order.delivery_time_windows ||
    order.delivery_time_windows.length === 0
  ) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Schedule color="primary" />
            <Typography variant="h6" fontWeight="bold">
              {t('orders.deliveryTimeWindow.title', 'Delivery Time Window')}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t(
              'orders.deliveryTimeWindow.noWindow',
              'No delivery time window has been set for this order.'
            )}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    try {
      // Handle both time formats (HH:MM:SS and HH:MM)
      const time = timeString.includes(':')
        ? timeString.split(':').slice(0, 2).join(':')
        : timeString;
      return time;
    } catch {
      return timeString;
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Schedule color="primary" />
          <Typography variant="h6" fontWeight="bold">
            {t('orders.deliveryTimeWindow.title', 'Delivery Time Window')}
          </Typography>
        </Box>

        <Stack spacing={2}>
          {order.delivery_time_windows.map((window, index) => (
            <Box key={window.id || index}>
              <Grid container spacing={2} alignItems="center">
                {/* Date and Time Information */}
                <Grid item xs={12} md={6}>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarToday fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'orders.deliveryTimeWindow.preferredDate',
                          'Preferred Date'
                        )}
                        :
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatDate(window.preferred_date)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccessTime fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {t('orders.deliveryTimeWindow.timeSlot', 'Time Slot')}:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatTime(window.time_slot_start)} -{' '}
                        {formatTime(window.time_slot_end)}
                      </Typography>
                    </Box>

                    {window.slot?.slot_name && (
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Schedule fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {t('orders.deliveryTimeWindow.slotName', 'Slot')}:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {window.slot.slot_name}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Grid>

                {/* Status and Confirmation */}
                <Grid item xs={12} md={6}>
                  <Stack spacing={1} alignItems="flex-start">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {window.is_confirmed ? (
                        <>
                          <CheckCircle color="success" fontSize="small" />
                          <Chip
                            label={t(
                              'orders.deliveryTimeWindow.confirmed',
                              'Confirmed'
                            )}
                            color="success"
                            size="small"
                          />
                        </>
                      ) : (
                        <>
                          <Warning color="warning" fontSize="small" />
                          <Chip
                            label={t(
                              'orders.deliveryTimeWindow.pending',
                              'Pending Confirmation'
                            )}
                            color="warning"
                            size="small"
                          />
                        </>
                      )}
                    </Box>

                    {window.is_confirmed && window.confirmed_at && (
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'orders.deliveryTimeWindow.confirmedAt',
                          'Confirmed at'
                        )}
                        : {new Date(window.confirmed_at).toLocaleString()}
                      </Typography>
                    )}

                    {window.confirmedByUser && (
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'orders.deliveryTimeWindow.confirmedBy',
                          'Confirmed by'
                        )}
                        : {window.confirmedByUser.first_name}{' '}
                        {window.confirmedByUser.last_name}
                      </Typography>
                    )}
                  </Stack>
                </Grid>
              </Grid>

              {/* Special Instructions */}
              {window.special_instructions && (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {t(
                      'orders.deliveryTimeWindow.specialInstructions',
                      'Special Instructions'
                    )}
                    :
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    {window.special_instructions}
                  </Typography>
                </Box>
              )}

              {/* Divider between windows */}
              {index < order.delivery_time_windows.length - 1 && (
                <Box sx={{ mt: 2, mb: 1 }}>
                  <hr
                    style={{ border: 'none', borderTop: '1px solid #e0e0e0' }}
                  />
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default DeliveryTimeWindowDisplay;
