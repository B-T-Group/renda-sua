import { Box, Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminMapActivity } from './adminMap.types';
import { pinColor } from './adminMapMarker';

const ITEMS: AdminMapActivity[] = [
  'active',
  'unavailable',
  'suspended',
  'open',
  'inactive',
];

const AdminMapLegend: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
      {ITEMS.map((activity) => (
        <LegendItem key={activity} activity={activity} label={t(`admin.map.activity.${activity}`, activity)} />
      ))}
    </Stack>
  );
};

function LegendItem({ activity, label }: { activity: AdminMapActivity; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: pinColor(activity) }} />
      <Box component="span" sx={{ typography: 'caption' }}>{label}</Box>
    </Stack>
  );
}

export default AdminMapLegend;
