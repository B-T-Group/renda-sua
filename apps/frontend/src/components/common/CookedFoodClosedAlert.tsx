import { Alert, Box, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CookedFoodStoreClosedDetails } from '../../hooks/useCheckoutPreflight';

function formatNextOpening(
  nextOpensAt: string | null | undefined,
  timezone: string,
  locale: string
): string | null {
  if (!nextOpensAt) return null;
  try {
    const date = new Date(nextOpensAt);
    if (Number.isNaN(date.getTime())) return null;
    const weekday = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone: timezone,
    }).format(date);
    const time = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(date);
    return `${weekday} · ${time}`;
  } catch {
    return null;
  }
}

function weekdayLabel(dayOfWeek: number, locale: string): string {
  try {
    const sunday = new Date(Date.UTC(2024, 0, 7));
    const day = new Date(sunday);
    day.setUTCDate(sunday.getUTCDate() + dayOfWeek);
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day);
  } catch {
    return String(dayOfWeek);
  }
}

export interface CookedFoodClosedAlertProps {
  message: string | null;
  details?: CookedFoodStoreClosedDetails | null;
  /** Shown when the kitchen is open (ASAP-only info). */
  openMessage: string;
  sx?: React.ComponentProps<typeof Alert>['sx'];
}

/**
 * ASAP timing alert for cooked food. When the kitchen is closed and structured
 * schedule details are present, shows title + next opening + hours list.
 */
export function CookedFoodClosedAlert({
  message,
  details,
  openMessage,
  sx,
}: CookedFoodClosedAlertProps) {
  const { t, i18n } = useTranslation();
  const closed = Boolean(message);
  const locale = i18n.language || 'en';
  const timezone = details?.timezone || 'UTC';
  const nextOpening = formatNextOpening(
    details?.next_opens_at,
    timezone,
    locale
  );
  const hours = details?.hours ?? [];
  const showStructured = closed && Boolean(details);

  return (
    <Alert severity={closed ? 'error' : 'info'} sx={sx}>
      {showStructured ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            {t('orders.deliveryTimeWindow.kitchenClosed.title', 'Kitchen closed')}
          </Typography>
          {nextOpening ? (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              <Typography component="span" variant="body2" color="text.secondary">
                {t(
                  'orders.deliveryTimeWindow.kitchenClosed.nextOpening',
                  'Next opening'
                )}
                {': '}
              </Typography>
              <strong>{nextOpening}</strong>
            </Typography>
          ) : null}
          {hours.length > 0 ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t(
                  'orders.deliveryTimeWindow.kitchenClosed.availableHours',
                  'Available hours'
                )}
              </Typography>
              {hours.map((slot) => (
                <Typography
                  key={`${slot.day_of_week}-${slot.start_time}-${slot.end_time}`}
                  variant="body2"
                >
                  {weekdayLabel(slot.day_of_week, locale)} {slot.start_time}–
                  {slot.end_time}
                </Typography>
              ))}
            </Box>
          ) : message ? (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {message}
            </Typography>
          ) : null}
        </Box>
      ) : (
        (message ?? openMessage)
      )}
    </Alert>
  );
}
