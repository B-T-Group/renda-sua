import {
  AccessTime,
  AccountBalanceWalletOutlined,
  CalendarMonthOutlined,
  CameraAltOutlined,
  Check,
  CreditCard,
  HourglassEmpty,
  PlaceOutlined,
  Restore,
  ShieldOutlined,
  WarningAmber,
} from '@mui/icons-material';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
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

const LINE_ICONS = {
  check: <Check fontSize="small" />,
  refund: <Restore fontSize="small" />,
  warn: <WarningAmber fontSize="small" />,
  card: <CreditCard fontSize="small" />,
};

/** Approved 01a/01b body on web: icon rows, the fee (or nothing-to-pay) box, free cancellation, pay-today footer. */
export function ReserveSummaryPanel({ summary, itemName, business, note }: { summary: ReserveSummary; itemName: string; business?: string | null; note?: string | null }) {
  const theme = useTheme();
  const box = summary.box;
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
      <Box
        data-testid={box.kind === 'fee' ? 'book-confirm-fee-rules' : 'book-confirm-nothing-today'}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: 1,
          borderColor: box.kind === 'fee' ? alpha(theme.palette.primary.main, 0.25) : 'divider',
          borderLeft: box.kind === 'free' ? `4px solid ${theme.palette.primary.main}` : undefined,
          bgcolor: box.kind === 'fee' ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
          {box.kind === 'fee' ? <CreditCard color="primary" fontSize="small" /> : <AccountBalanceWalletOutlined color="primary" fontSize="small" />}
          <Typography fontWeight={800} color={box.kind === 'fee' ? 'primary' : 'text.primary'}>{box.title}</Typography>
        </Stack>
        <Stack spacing={0.75}>
          {box.lines.map((line, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="flex-start" sx={{ color: line.warn ? 'warning.dark' : 'text.secondary' }}>
              {LINE_ICONS[line.icon]}
              <Typography variant="body2" color={line.warn ? 'warning.dark' : 'text.primary'}>{line.text}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
      {summary.cancelLine ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
          <Check fontSize="small" color="primary" />
          <Typography variant="body2" color="text.secondary">{summary.cancelLine}</Typography>
        </Stack>
      ) : null}
      {note ? (
        <Typography variant="body2" color="text.secondary">{note}</Typography>
      ) : null}
      <Stack spacing={1} sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider' }} data-testid="reserve-footer">
        {[summary.footer.today, summary.footer.pickup].map((line, i) => (
          <Stack key={i} direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={700}>{line.title}</Typography>
              <Typography variant="caption" color="text.secondary">{line.sub}</Typography>
            </Box>
            <Typography variant="h6" fontWeight={800}>{line.amount}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
