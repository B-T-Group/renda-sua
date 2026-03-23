import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { RentalTakenWindow } from '../../hooks/useRentalApi';
import { useRentalApi } from '../../hooks/useRentalApi';

export const RENTAL_REQUEST_SECTION_ID = 'rental-request-section';

function formatDatetimeLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da}T${h}:${mi}`;
}

function snapToHalfHourLocal(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  const mins = out.getMinutes();
  const rounded = Math.round(mins / 30) * 30;
  out.setMinutes(rounded);
  if (out.getMinutes() === 60) {
    out.setHours(out.getHours() + 1);
    out.setMinutes(0);
  }
  return out;
}

function nextLocalHalfHourAfterNow(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMilliseconds(0);
  const m = d.getMinutes();
  const remainder = m % 30;
  if (remainder !== 0) {
    d.setMinutes(m + (30 - remainder));
  } else {
    d.setMinutes(m + 30);
  }
  while (d.getTime() <= Date.now()) {
    d.setMinutes(d.getMinutes() + 30);
  }
  return d;
}

function snapDatetimeLocalInput(raw: string): string {
  if (!raw || raw.length < 16) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return formatDatetimeLocal(snapToHalfHourLocal(d));
}

function rangesOverlapMs(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && a1 > b0;
}

export interface RentalListingRequestSectionProps {
  listingId: string;
  isAuthenticated: boolean;
}

export const RentalListingRequestSection: React.FC<RentalListingRequestSectionProps> = ({
  listingId,
  isAuthenticated,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createRequest, fetchListingBookedWindows } = useRentalApi();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [windows, setWindows] = useState<RentalTakenWindow[]>([]);

  const minStartValue = useMemo(() => formatDatetimeLocal(nextLocalHalfHourAfterNow()), []);

  const loadWindows = useCallback(async () => {
    try {
      const w = await fetchListingBookedWindows(listingId);
      setWindows(w);
    } catch {
      setWindows([]);
    }
  }, [fetchListingBookedWindows, listingId]);

  useEffect(() => {
    void loadWindows();
  }, [loadWindows]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const s = nextLocalHalfHourAfterNow();
    const e = new Date(s);
    e.setDate(e.getDate() + 1);
    setStart(formatDatetimeLocal(s));
    setEnd(formatDatetimeLocal(snapToHalfHourLocal(e)));
  }, [isAuthenticated, listingId]);

  const onStartChange = (raw: string) => {
    const snapped = snapDatetimeLocalInput(raw);
    setStart(snapped);
    if (!snapped) return;
    const s = new Date(snapped);
    if (Number.isNaN(s.getTime())) return;
    if (end) {
      const e = new Date(end);
      if (!Number.isNaN(e.getTime()) && e <= s) {
        const next = new Date(s);
        next.setMinutes(next.getMinutes() + 30);
        setEnd(formatDatetimeLocal(next));
      }
    }
  };

  const onEndChange = (raw: string) => {
    setEnd(snapDatetimeLocalInput(raw));
  };

  const submitRequest = async () => {
    setMsg(null);
    if (!start || !end) {
      setMsg(t('rentals.fillDates', 'Choose start and end'));
      return;
    }
    const sMs = new Date(start).getTime();
    const eMs = new Date(end).getTime();
    if (Number.isNaN(sMs) || Number.isNaN(eMs)) {
      setMsg(t('rentals.fillDates', 'Choose start and end'));
      return;
    }
    if (sMs <= Date.now()) {
      setMsg(t('rentals.requestForm.startMustBeFuture', 'Start must be in the future.'));
      return;
    }
    if (eMs <= sMs) {
      setMsg(t('rentals.requestForm.endAfterStart', 'End must be after start.'));
      return;
    }
    for (const w of windows) {
      const w0 = new Date(w.startAt).getTime();
      const w1 = new Date(w.endAt).getTime();
      if (rangesOverlapMs(sMs, eMs, w0, w1)) {
        setMsg(t('rentals.requestForm.overlapsTaken', 'Those dates overlap an existing booking. Pick another range.'));
        return;
      }
    }
    try {
      await createRequest({
        rentalLocationListingId: listingId,
        requestedStartAt: new Date(start).toISOString(),
        requestedEndAt: new Date(end).toISOString(),
        clientRequestNote: notes.trim() || undefined,
      });
      void loadWindows();
      navigate('/rentals/request-submitted');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMsg(
        err?.response?.data?.message ||
          (e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'))
      );
    }
  };

  const stepStyle = { step: 1800, style: { fontSize: 16 } };

  return (
    <>
      <Box
        component="section"
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <Card
          id={RENTAL_REQUEST_SECTION_ID}
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: '100%',
            borderRadius: 3,
            border: 1,
            borderColor: 'divider',
            overflow: 'visible',
            scrollMarginTop: { xs: 16, sm: 24 },
          }}
        >
          <CardContent
            sx={{
              p: { xs: 2.5, sm: 3 },
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            {isAuthenticated ? (
              <Stack spacing={2.5} sx={{ width: '100%', maxWidth: '100%' }}>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {t('rentals.requestRental', 'Request this rental')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t(
                    'rentals.detail.requestSubtitle',
                    'Choose your dates. The business will confirm availability.'
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  {t(
                    'rentals.requestForm.halfHourHint',
                    'Times are limited to the hour or half-hour (e.g. 9:00, 9:30).'
                  )}
                </Typography>
              </Box>
              <Stack spacing={2} sx={{ width: '100%' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ width: '100%', alignItems: 'stretch' }}
                >
                  <TextField
                    label={t('rentals.start', 'Start')}
                    type="datetime-local"
                    value={start}
                    onChange={(e) => onStartChange(e.target.value)}
                    onBlur={() => start && onStartChange(start)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="small"
                    inputProps={{ ...stepStyle, min: minStartValue }}
                    sx={{
                      flex: { sm: '1 1 0' },
                      minWidth: 0,
                      width: { xs: '100%', sm: 'auto' },
                    }}
                  />
                  <TextField
                    label={t('rentals.end', 'End')}
                    type="datetime-local"
                    value={end}
                    onChange={(e) => onEndChange(e.target.value)}
                    onBlur={() => end && onEndChange(end)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="small"
                    inputProps={{
                      ...stepStyle,
                      min: start || minStartValue,
                    }}
                    sx={{
                      flex: { sm: '1 1 0' },
                      minWidth: 0,
                      width: { xs: '100%', sm: 'auto' },
                    }}
                  />
                </Stack>
                <TextField
                  label={t('rentals.requestForm.optionalNotes', 'Optional notes for the business')}
                  placeholder={t(
                    'rentals.requestForm.optionalNotesPlaceholder',
                    'Special requirements, access details, questions…'
                  )}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                  size="small"
                  inputProps={{ maxLength: 2000 }}
                  helperText={t('rentals.requestForm.optionalNotesHelper', 'Max 2000 characters')}
                  sx={{ width: '100%', alignSelf: 'stretch' }}
                />
              </Stack>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{ width: '100%', maxWidth: '100%' }}
              >
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => void submitRequest()}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                    flex: { sm: '1 1 auto' },
                    minWidth: { sm: 220 },
                    maxWidth: '100%',
                    px: 4,
                    py: 1.25,
                    minHeight: 48,
                    fontWeight: 700,
                    borderRadius: 2,
                    whiteSpace: 'nowrap',
                    touchAction: 'manipulation',
                  }}
                >
                  {t('rentals.submitRequest', 'Submit request')}
                </Button>
                <Button
                  variant="text"
                  onClick={() => navigate('/rentals/requests')}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                    minHeight: 44,
                    flexShrink: 0,
                    whiteSpace: { sm: 'nowrap' },
                    alignSelf: { xs: 'stretch', sm: 'center' },
                  }}
                >
                  {t('rentals.myRequests', 'My rental requests')}
                </Button>
              </Stack>
              {msg ? (
                <Alert
                  severity="error"
                  sx={{
                    borderRadius: 2,
                    '& .MuiAlert-message': { overflowWrap: 'anywhere' },
                  }}
                >
                  {msg}
                </Alert>
              ) : null}
              </Stack>
            ) : (
              <Stack
                spacing={2}
                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                sx={{ width: '100%', maxWidth: '100%' }}
              >
              <Typography variant="h6" fontWeight={700}>
                {t('rentals.requestRental', 'Request this rental')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('rentals.loginToRequest', 'Log in to request')}
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => navigate('/app')}
                sx={{
                  px: 4,
                  py: 1.25,
                  minHeight: 48,
                  fontWeight: 700,
                  borderRadius: 2,
                  maxWidth: { sm: 320 },
                  touchAction: 'manipulation',
                }}
              >
                {t('rentals.loginToRequest', 'Log in to request')}
              </Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </>
  );
};
