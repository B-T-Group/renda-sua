import { Check, CreditCard, InfoOutlined, Restore, WarningAmber } from '@mui/icons-material';
import { Box, Button, Drawer, Stack, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReserveSummary } from '../../utils/rentals/reserveSummary';

const LINE_ICONS = {
  check: <Check fontSize="small" />,
  refund: <Restore fontSize="small" />,
  warn: <WarningAmber fontSize="small" />,
  card: <CreditCard fontSize="small" />,
};

/** The reserve dialog's one money summary: pay today, pay at pickup, the key rule and a Details link. */
export function ReserveStickyFooter({ summary }: { summary: ReserveSummary }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Stack spacing={1} data-testid="reserve-footer">
      {[summary.footer.today, summary.footer.pickup].map((line, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700}>{line.title}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">{line.sub}</Typography>
          </Box>
          <Typography variant="h6" fontWeight={800}>{line.amount}</Typography>
        </Stack>
      ))}
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <InfoOutlined fontSize="small" color="primary" />
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{summary.detailsLine}</Typography>
        <Button size="small" onClick={() => setOpen(true)} data-testid="reserve-details-open">
          {t('rentals.reserve.detailsButton', 'Details')}
        </Button>
      </Stack>
      <ReserveDetailsDrawer open={open} summary={summary} onClose={() => setOpen(false)} />
    </Stack>
  );
}

function ReserveDetailsDrawer({ open, summary, onClose }: { open: boolean; summary: ReserveSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const { box, cancelLine } = summary;
  const lines = [...(cancelLine ? [{ icon: 'check' as const, text: cancelLine, warn: false }] : []), ...box.lines];
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}>
      <Stack spacing={1.5} sx={{ p: 2.5, maxWidth: 600, width: '100%', mx: 'auto' }} data-testid="reserve-details-sheet">
        <Typography variant="h6" fontWeight={800}>{box.title}</Typography>
        {lines.map((line, i) => (
          <Stack key={i} direction="row" spacing={1.25} alignItems="flex-start" sx={{ color: line.warn ? 'warning.dark' : 'text.secondary' }}>
            {LINE_ICONS[line.icon]}
            <Typography variant="body2" color={line.warn ? 'warning.dark' : 'text.primary'}>{line.text}</Typography>
          </Stack>
        ))}
        <Button variant="contained" onClick={onClose} data-testid="reserve-details-close">{t('common.close', 'Close')}</Button>
      </Stack>
    </Drawer>
  );
}
