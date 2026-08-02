import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DayName,
  DEFAULT_OPERATING_HOURS,
  OperatingHours,
} from '../../utils/operatingHours';

const DAY_ORDER: DayName[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export interface AdminOperatingHoursSummaryProps {
  operatingHours?: OperatingHours | null;
}

/** Read-only, compact weekly hours list for admin views (support/reliability triage). */
export const AdminOperatingHoursSummary: React.FC<
  AdminOperatingHoursSummaryProps
> = ({ operatingHours }) => {
  const { t } = useTranslation();
  const hours = operatingHours ?? DEFAULT_OPERATING_HOURS;

  return (
    <Stack spacing={0.25}>
      {DAY_ORDER.map((day) => {
        const dayHours = hours[day];
        const isClosed = !dayHours || dayHours.closed || !dayHours.open;
        return (
          <Box
            key={day}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {t(`admin.operatingHours.days.${day}`, day)}
            </Typography>
            <Typography
              variant="caption"
              color={isClosed ? 'text.disabled' : 'text.primary'}
              fontWeight={isClosed ? 400 : 600}
            >
              {isClosed
                ? t('admin.operatingHours.closed', 'Closed')
                : `${dayHours!.open} – ${dayHours!.close}`}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
};

export default AdminOperatingHoursSummary;
