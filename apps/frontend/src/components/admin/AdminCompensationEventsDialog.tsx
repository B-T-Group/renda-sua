import { ReceiptLong } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CompensationEventRow } from '../../hooks/useAdminPerformance';

interface AdminCompensationEventsDialogProps {
  countryCode: string;
  fetchEvents: (countryCode: string) => Promise<CompensationEventRow[] | null>;
}

export const AdminCompensationEventsDialog: React.FC<
  AdminCompensationEventsDialogProps
> = ({ countryCode, fetchEvents }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CompensationEventRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    setLoadError(null);
    const data = await fetchEvents(countryCode);
    setEvents(data);
    if (!data) {
      setLoadError(
        t(
          'admin.performance.compensationEvents.loadError',
          'Could not load compensation events.'
        )
      );
    }
    setLoading(false);
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<ReceiptLong />}
        onClick={() => void handleOpen()}
      >
        {t(
          'admin.performance.compensationEvents.button',
          'Compensation ledger'
        )}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pr: 6 }}>
          {t(
            'admin.performance.compensationEvents.title',
            'Representative compensation'
          )}
          <IconButton
            onClick={() => setOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'admin.performance.compensationEvents.subtitle',
              'Credited and pending compensation events for this market.'
            )}
          </Typography>
          {loading && <CircularProgress size={24} />}
          {loadError && <Alert severity="error">{loadError}</Alert>}
          {events && events.length === 0 && (
            <Alert severity="info">
              {t(
                'admin.performance.compensationEvents.empty',
                'No compensation events for this market.'
              )}
            </Alert>
          )}
          {events && events.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t('admin.performance.compensationEvents.colRule', 'Rule')}
                  </TableCell>
                  <TableCell>
                    {t(
                      'admin.performance.compensationEvents.colBusiness',
                      'Business'
                    )}
                  </TableCell>
                  <TableCell>
                    {t(
                      'admin.performance.compensationEvents.colAmount',
                      'Amount'
                    )}
                  </TableCell>
                  <TableCell>
                    {t(
                      'admin.performance.compensationEvents.colStatus',
                      'Status'
                    )}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.rule_code}</TableCell>
                    <TableCell>{event.business?.name ?? '—'}</TableCell>
                    <TableCell>
                      {event.amount} {event.currency}
                    </TableCell>
                    <TableCell>{event.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
