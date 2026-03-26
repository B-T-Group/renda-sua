import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { RentalTakenWindow } from '../../hooks/useRentalApi';
import { useRentalApi } from '../../hooks/useRentalApi';
import { localPickerInstantToRequestParts, requestedSlotUtcIso } from '../../utils/rentalRequestUtc';
import { estimateTotalFromSelectionRanges } from '../../utils/rentalPricingLines';
import {
  bookedSegmentsForLocalDay,
  dayHasNoBookedOverlap,
  formatSelectionLabel,
  freeSlotEndsLocal,
  freeSlotStartsLocal,
  listingDayBoundsLocal,
  maximalFreeHourRangesLocal,
  mergeRangeIntoSelections,
  rangesOverlapMs,
  rentalBillableHours,
  totalBillableHours,
  type SelectionRange,
  type WeeklyRow,
} from './rentalRequestScheduleUtils';

export const RENTAL_REQUEST_SECTION_ID = 'rental-request-section';
const RENTAL_MIN_START_BUFFER_MS = 2 * 60 * 60 * 1000;

function parseDateInputLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

function todayDateInputValue(): string {
  const n = new Date();
  const mo = String(n.getMonth() + 1).padStart(2, '0');
  const da = String(n.getDate()).padStart(2, '0');
  return `${n.getFullYear()}-${mo}-${da}`;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'XAF',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export interface RentalListingRequestSectionProps {
  listingId: string;
  isAuthenticated: boolean;
  minRentalHours?: number;
  maxRentalHours?: number | null;
  weeklyAvailability?: WeeklyRow[];
  basePricePerHour?: number;
  basePricePerDay?: number;
  currency?: string;
}

export const RentalListingRequestSection: React.FC<RentalListingRequestSectionProps> = ({
  listingId,
  isAuthenticated,
  minRentalHours = 1,
  maxRentalHours = null,
  weeklyAvailability = [],
  basePricePerHour = 0,
  basePricePerDay = 0,
  currency = 'XAF',
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { createRequest, fetchListingBookedWindows } = useRentalApi();
  const [booked, setBooked] = useState<RentalTakenWindow[]>([]);
  const [dateStr, setDateStr] = useState(todayDateInputValue());
  const [startMs, setStartMs] = useState<number | ''>('');
  const [endMs, setEndMs] = useState<number | ''>('');
  const [allDayChecked, setAllDayChecked] = useState(false);
  const [selections, setSelections] = useState<SelectionRange[]>([]);
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadBooked = useCallback(async () => {
    try {
      setBooked(await fetchListingBookedWindows(listingId));
    } catch {
      setBooked([]);
    }
  }, [fetchListingBookedWindows, listingId]);

  useEffect(() => {
    void loadBooked();
  }, [loadBooked]);

  const dayAnchor = useMemo(() => parseDateInputLocal(dateStr), [dateStr]);
  const dayBounds = useMemo(
    () => listingDayBoundsLocal(dayAnchor, weeklyAvailability),
    [dayAnchor, weeklyAvailability]
  );

  const dayStartEnd = useMemo(() => {
    const start = new Date(dayAnchor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }, [dayAnchor]);

  const bookedSegs = useMemo(
    () => bookedSegmentsForLocalDay(dayStartEnd.start, dayStartEnd.end, booked),
    [booked, dayStartEnd.end, dayStartEnd.start]
  );

  const nowMs = Date.now();
  const minStartMs = nowMs + RENTAL_MIN_START_BUFFER_MS;
  const slotStarts = useMemo(() => {
    if (!dayBounds) return [];
    return freeSlotStartsLocal(dayBounds.open, dayBounds.close, bookedSegs, minStartMs);
  }, [bookedSegs, dayBounds, minStartMs]);

  const slotEnds = useMemo(() => {
    if (!dayBounds || startMs === '') return [];
    return freeSlotEndsLocal(Number(startMs), dayBounds.close, bookedSegs);
  }, [bookedSegs, dayBounds, startMs]);

  const canAllDay =
    !!dayBounds && dayHasNoBookedOverlap(dayStartEnd.start, dayStartEnd.end, booked);

  useEffect(() => {
    setStartMs('');
    setEndMs('');
    setAllDayChecked(false);
  }, [dateStr]);

  const addRange = () => {
    setMsg(null);
    if (allDayChecked) {
      if (!dayBounds || !canAllDay) return;
      const openMs = dayBounds.open.getTime();
      if (openMs > minStartMs) {
        setSelections((prev) =>
          mergeRangeIntoSelections(prev, openMs, dayBounds.close.getTime(), {
            billing: 'all_day',
            calendarDate: dateStr,
          })
        );
      } else {
        const ranges = maximalFreeHourRangesLocal(
          dayBounds.open,
          dayBounds.close,
          bookedSegs,
          minStartMs
        );
        if (ranges.length === 0) return;
        setSelections((prev) => {
          let next = prev;
          for (const r of ranges) {
            next = mergeRangeIntoSelections(next, r.startMs, r.endMs, { billing: 'hourly' });
          }
          return next;
        });
      }
      setStartMs('');
      setEndMs('');
      setAllDayChecked(false);
      return;
    }
    if (!dayBounds || startMs === '' || endMs === '') {
      setMsg(t('rentals.requestForm.pickStartEnd', 'Choose a start and end time.'));
      return;
    }
    const s = Number(startMs);
    const e = Number(endMs);
    if (!(e > s)) {
      setMsg(t('rentals.requestForm.endAfterStart', 'End must be after start.'));
      return;
    }
    if (s < minStartMs) {
      setMsg(t('rentals.requestForm.startMustBeFuture', 'Start must be in the future.'));
      return;
    }
    for (const w of booked) {
      const w0 = new Date(w.startAt).getTime();
      const w1 = new Date(w.endAt).getTime();
      if (rangesOverlapMs(s, e, w0, w1)) {
        setMsg(t('rentals.requestForm.overlapsTaken', 'That time overlaps an existing booking.'));
        return;
      }
    }
    setSelections((prev) => mergeRangeIntoSelections(prev, s, e, { billing: 'hourly' }));
    setStartMs('');
    setEndMs('');
  };

  const removeSelection = (id: string) => {
    setSelections((prev) => prev.filter((r) => r.id !== id));
  };

  const hoursTotal = useMemo(() => totalBillableHours(selections), [selections]);
  const { lines: estimateLines, total: estimatedTotal } = useMemo(
    () => estimateTotalFromSelectionRanges(selections, basePricePerHour, basePricePerDay),
    [basePricePerDay, basePricePerHour, selections]
  );

  const validateBeforeSubmit = useCallback((): string | null => {
    if (selections.length === 0) {
      return t('rentals.requestForm.addOneRange', 'Add at least one time range.');
    }
    if (hoursTotal < minRentalHours) {
      return t('rentals.requestForm.belowMinHours', 'Selected time is below minimum hours.');
    }
    if (maxRentalHours != null && hoursTotal > maxRentalHours) {
      return t('rentals.requestForm.aboveMaxHours', 'Selected time exceeds maximum hours.');
    }
    for (const r of selections) {
      if (r.billing === 'all_day') {
        if (!r.calendarDate) {
          return t('rentals.requestForm.allDayNeedsDate', 'All-day selection is missing a date.');
        }
        if (!dayHasNoBookedOverlap(dayStartEnd.start, dayStartEnd.end, booked)) {
          return t(
            'rentals.requestForm.allDayDisabledHint',
            'Add all available hours is disabled when any time that day is already booked.'
          );
        }
      }
      if (r.startMs < minStartMs) {
        return t('rentals.requestForm.startMustBeFuture', 'Start must be in the future.');
      }
      for (const w of booked) {
        const w0 = new Date(w.startAt).getTime();
        const w1 = new Date(w.endAt).getTime();
        if (rangesOverlapMs(r.startMs, r.endMs, w0, w1)) {
          return t('rentals.requestForm.overlapsTaken', 'A selection overlaps an existing booking.');
        }
      }
    }
    return null;
  }, [booked, dayStartEnd, hoursTotal, maxRentalHours, minRentalHours, minStartMs, selections, t]);

  const openConfirm = () => {
    setMsg(null);
    const err = validateBeforeSubmit();
    if (err) {
      setMsg(err);
      return;
    }
    setConfirmOpen(true);
  };

  const submitRequest = async () => {
    const err = validateBeforeSubmit();
    if (err) {
      setMsg(err);
      setConfirmOpen(false);
      return;
    }
    setSubmitting(true);
    setMsg(null);
    const windows = selections.map((r) => {
      const s = localPickerInstantToRequestParts(r.startMs);
      const e = localPickerInstantToRequestParts(r.endMs);
      const base = {
        requestedStartAt: requestedSlotUtcIso(s.dateKey, s.hour, s.minute),
        requestedEndAt: requestedSlotUtcIso(e.dateKey, e.hour, e.minute),
      };
      if (r.billing === 'all_day' && r.calendarDate) {
        return { ...base, billing: 'all_day' as const, calendarDate: r.calendarDate };
      }
      return base;
    });
    const starts = selections.map((r) => r.startMs);
    const ends = selections.map((r) => r.endMs);
    const envS = localPickerInstantToRequestParts(Math.min(...starts));
    const envE = localPickerInstantToRequestParts(Math.max(...ends));
    try {
      await createRequest({
        rentalLocationListingId: listingId,
        requestedStartAt: requestedSlotUtcIso(envS.dateKey, envS.hour, envS.minute),
        requestedEndAt: requestedSlotUtcIso(envE.dateKey, envE.hour, envE.minute),
        windows,
        clientRequestNote: notes.trim() || undefined,
      });
      setConfirmOpen(false);
      void loadBooked();
      navigate('/rentals/request-submitted');
    } catch (e: unknown) {
      const http = e as { response?: { data?: { message?: string } } };
      setMsg(
        http?.response?.data?.message ||
          (e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'))
      );
    } finally {
      setSubmitting(false);
    }
  };

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
                      'rentals.requestForm.slotSubtitle',
                      'Pick a day, choose times within open hours, then add each range to your request.'
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {t(
                      'rentals.requestForm.halfHourHint',
                      'Times are in full-hour slots (e.g. 9:00–10:00).'
                    )}
                  </Typography>
                </Box>

                {!dayBounds ? (
                  <Alert severity="info">
                    {t('rentals.requestForm.closedDay', 'The business is closed on this day. Pick another date.')}
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    <TextField
                      label={t('rentals.requestForm.pickDay', 'Date')}
                      type="date"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: todayDateInputValue() }}
                      size="small"
                      fullWidth
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                      <FormControlLabel
                        sx={{ ml: 0, mr: 0.5, minWidth: { sm: 140 } }}
                        control={
                          <Checkbox
                            checked={allDayChecked}
                            onChange={(e) => setAllDayChecked(e.target.checked)}
                            disabled={!dayBounds || !canAllDay}
                          />
                        }
                        label={t('rentals.requestForm.allDayLabel', 'All day')}
                      />
                      <FormControl size="small" fullWidth sx={{ flex: 1 }}>
                        <InputLabel>{t('rentals.requestForm.slotStart', 'Start time')}</InputLabel>
                        <Select
                          label={t('rentals.requestForm.slotStart', 'Start time')}
                          value={startMs === '' ? '' : String(startMs)}
                          onChange={(e) => {
                            setStartMs(e.target.value === '' ? '' : Number(e.target.value));
                            setEndMs('');
                          }}
                          disabled={allDayChecked}
                        >
                          <MenuItem value="">
                            <em>{t('rentals.requestForm.selectTime', 'Select')}</em>
                          </MenuItem>
                          {slotStarts.map((d) => (
                            <MenuItem key={d.getTime()} value={String(d.getTime())}>
                              {new Intl.DateTimeFormat(i18n.language, {
                                hour: 'numeric',
                                minute: '2-digit',
                              }).format(d)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl size="small" fullWidth sx={{ flex: 1 }}>
                        <InputLabel>{t('rentals.requestForm.slotEnd', 'End time')}</InputLabel>
                        <Select
                          label={t('rentals.requestForm.slotEnd', 'End time')}
                          value={endMs === '' ? '' : String(endMs)}
                          onChange={(e) => setEndMs(e.target.value === '' ? '' : Number(e.target.value))}
                          disabled={allDayChecked || startMs === ''}
                        >
                          <MenuItem value="">
                            <em>{t('rentals.requestForm.selectTime', 'Select')}</em>
                          </MenuItem>
                          {slotEnds.map((d) => (
                            <MenuItem key={d.getTime()} value={String(d.getTime())}>
                              {new Intl.DateTimeFormat(i18n.language, {
                                hour: 'numeric',
                                minute: '2-digit',
                              }).format(d)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                    <Button variant="contained" onClick={addRange} disabled={!dayBounds} fullWidth>
                      {allDayChecked
                        ? dayBounds && dayBounds.open.getTime() > minStartMs
                          ? t('rentals.requestForm.addFullDayRate', 'Add full day (daily rate)')
                          : t('rentals.requestForm.allDay', 'Add all available hours')
                        : t('rentals.requestForm.addRange', 'Add to request')}
                    </Button>
                    {dayBounds && !canAllDay ? (
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'rentals.requestForm.allDayDisabledHint',
                          'Add all available hours is disabled when any time that day is already booked.'
                        )}
                      </Typography>
                    ) : dayBounds && slotStarts.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'rentals.requestForm.noBookableSlotsHint',
                          'No bookable hours left on this day. Try another date.'
                        )}
                      </Typography>
                    ) : null}
                  </Stack>
                )}

                {selections.length > 0 ? (
                  <>
                    <Divider />
                    <Typography variant="subtitle2" fontWeight={600}>
                      {t('rentals.requestForm.yourRanges', 'Your selected times')}
                    </Typography>
                    <List dense disablePadding sx={{ mb: 0.5 }}>
                      {selections.map((r, idx) => (
                        <ListItem
                          key={r.id}
                          sx={{
                            py: 0.75,
                            px: 1,
                            mb: 0.6,
                            borderRadius: 1.5,
                            border: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                          }}
                          secondaryAction={
                            <IconButton edge="end" aria-label="remove" onClick={() => removeSelection(r.id)}>
                              <DeleteOutlineIcon />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={formatSelectionLabel(r.startMs, r.endMs, i18n.language)}
                            secondary={
                              <>
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {r.billing === 'all_day'
                                    ? t('rentals.requestForm.allDayRateLine', 'All day — daily rate')
                                    : t('rentals.requestForm.lineHourly', '{{h}} h × {{rate}}', {
                                        h: rentalBillableHours(r.startMs, r.endMs),
                                        rate: formatMoney(basePricePerHour, currency),
                                      })}
                                </Typography>
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{ ml: 1, fontWeight: 800, color: 'success.dark' }}
                                >
                                  {formatMoney(estimateLines[idx]?.subtotal ?? 0, currency)}
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                    <Typography variant="body2" color="text.secondary">
                      {t('rentals.requestForm.runningTotal', 'Estimated total')}:{' '}
                      <strong>{formatMoney(estimatedTotal, currency)}</strong>
                      {' · '}
                      {t('rentals.requestForm.totalHoursLineShort', '{{h}} billable hours total', {
                        h: hoursTotal,
                      })}
                    </Typography>
                  </>
                ) : null}

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
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => openConfirm()}
                    disabled={selections.length === 0}
                    sx={{
                      minHeight: 48,
                      fontWeight: 700,
                      borderRadius: 2,
                      px: 4,
                    }}
                  >
                    {t('rentals.submitRequest', 'Submit request')}
                  </Button>
                  <Button variant="text" onClick={() => navigate('/rentals/requests')} sx={{ minHeight: 44 }}>
                    {t('rentals.myRequests', 'My rental requests')}
                  </Button>
                </Stack>

                {msg ? (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {msg}
                  </Alert>
                ) : null}
              </Stack>
            ) : (
              <Stack spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
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
                  sx={{ maxWidth: { sm: 320 }, minHeight: 48, fontWeight: 700, borderRadius: 2 }}
                >
                  {t('rentals.loginToRequest', 'Log in to request')}
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>

      <Dialog open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('rentals.requestForm.confirmTitle', 'Confirm your request')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'rentals.requestForm.confirmIntro',
              'Review your selected times and estimated price before sending.'
            )}
          </Typography>
          <List dense>
            {selections.map((r) => (
              <ListItem key={r.id}>
                <ListItemText
                  primary={formatSelectionLabel(r.startMs, r.endMs, i18n.language)}
                  secondary={
                    r.billing === 'all_day'
                      ? t('rentals.requestForm.allDayRateLine', 'All day — daily rate')
                      : t('rentals.requestForm.rangeHours', '{{h}} h', {
                          h: rentalBillableHours(r.startMs, r.endMs),
                        })
                  }
                />
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={600}>
            {t('rentals.requestForm.priceBreakdown', 'Price breakdown')}
          </Typography>
          <List dense>
            {estimateLines.map((line, idx) => (
              <ListItem key={idx} disableGutters>
                <ListItemText
                  primary={
                    line.kind === 'all_day'
                      ? t('rentals.requestForm.lineAllDay', 'Full day {{date}}', {
                          date: line.calendarDate,
                        })
                      : t('rentals.requestForm.lineHourly', '{{h}} h × {{rate}}', {
                          h: line.billableHours,
                          rate: formatMoney(line.ratePerHour, currency),
                        })
                  }
                  secondary={formatMoney(line.subtotal, currency)}
                />
              </ListItem>
            ))}
          </List>
          <Typography variant="body1" fontWeight={600} sx={{ mt: 1 }}>
            {t('rentals.requestForm.confirmHours', 'Total hours')}: {hoursTotal}
          </Typography>
          <Typography variant="h6" fontWeight={800} color="primary" sx={{ mt: 1 }}>
            {t('rentals.requestForm.confirmPrice', 'Estimated price')}: {formatMoney(estimatedTotal, currency)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {t(
              'rentals.requestForm.confirmPriceNote',
              'Final price is confirmed when the business accepts your request.'
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={() => void submitRequest()} disabled={submitting}>
            {submitting ? t('common.loading', 'Loading...') : t('rentals.requestForm.confirmSend', 'Send request')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
