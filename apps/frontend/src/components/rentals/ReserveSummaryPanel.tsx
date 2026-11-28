import {
  AccessTime,
  CalendarMonthOutlined,
  CameraAltOutlined,
  HourglassEmpty,
  PlaceOutlined,
  Restore,
  ShieldOutlined,
} from '@mui/icons-material';
import { Box, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import type { ReserveIcon, ReserveSummary } from '../../utils/rentals/reserveSummary';

const ROW_ICONS: Record<ReserveIcon, React.ReactElement> = {
  calendar: <CalendarMonthOutlined fontSize="small" color="action" />,
  clock: <AccessTime fontSize="small" color="action" />,
  shield: <ShieldOutlined fontSize="small" color="action" />,
  pin: <PlaceOutlined fontSize="small" color="action" />,
  camera: <CameraAltOutlined fontSize="small" color="action" />,
  timer: <HourglassEmpty fontSize="small" color="action" />,
  refund: <Restore fontSize="small" color="action" />,
};

/** Approved 01a/01b body on web: the item and its icon rows. Money rules live in `ReserveStickyFooter`. */
export function ReserveSummaryPanel({ summary, itemName, business }: { summary: ReserveSummary; itemName: string; business?: string | null }) {
  return (
    <Stack spacing={1.5} data-testid="reserve-summary">
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Typography fontWeight={700}>{itemName}</Typography>
        {business ? <Typography variant="body2" color="text.secondary">{business}</Typography> : null}
      </Paper>
      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        {summary.rows.map((row, i) => (
          <Box
            key={row.key}
            data-testid={`reserve-row-${row.key}`}
            sx={{ px: 1.5, py: 1.1, borderTop: i ? 1 : 0, borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              {ROW_ICONS[row.icon]}
              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, maxWidth: '45%' }}>{row.label}</Typography>
              {row.stacked ? null : (
                <Box sx={{ flex: 1, textAlign: 'right' }}>
                  <Typography variant="body2" fontWeight={700}>{row.value}</Typography>
                  {row.sub ? <Typography variant="caption" color="text.secondary" display="block">{row.sub}</Typography> : null}
                </Box>
              )}
            </Stack>
            {row.stacked ? <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5, pl: 3.5 }}>{row.value}</Typography> : null}
          </Box>
        ))}
      </Paper>
    </Stack>
  );
}
