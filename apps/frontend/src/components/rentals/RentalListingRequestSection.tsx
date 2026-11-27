import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { RentalTakenWindow } from '../../hooks/useRentalApi';
import { useRentalApi } from '../../hooks/useRentalApi';
import { SITE_EVENT_ASSISTANT_RENTAL_REQUEST_CREATED, useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';
import { consumeRentalRequestAttribution } from '../../utils/rentalAssistantAttribution';
import { formatCatalogMoney } from '../../utils/rentalRequestDisplay';
import { useClientFlags } from '../../hooks/useClientFlags';
import { CardWindowBanner, CardWindowCalendar } from './CardWindowCalendar';
import {
  cardEndMisses,
  cardWindowErrorMessage,
  cardWindowSendReason,
  cardWindowWarning,
  effectiveCardEnd,
  formatCardCutoff,
  type CardWindowFields,
} from '../../utils/rentals/cardWindow';
import { localPickerInstantToRequestParts, requestedSlotUtcIso } from '../../utils/rentalRequestUtc';
import { estimateTotalFromSelectionRanges } from '../../utils/rentalPricingLines';
import {
  formatSelectionLabel,
  remainingUnitsInRange,
  rentalBillableHours,
  totalBillableHours,
  type SelectionRange,
  type WeeklyRow,
} from './rentalRequestScheduleUtils';
import { RentalDayHoursDialog } from './dayHours/RentalDayHoursDialog';
import { dayHoursBlockError, dayHoursListingModel } from './dayHours/dayHoursListingModel';
import { fromSelectionRanges, listingNowMs } from '../../utils/rentalDayHoursPicker';
import { submitRuleText } from '../../utils/rentalDayHoursCopy';

export const RENTAL_REQUEST_SECTION_ID = 'rental-request-section';


function exclusiveDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor < last && days.length < 30) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export interface RentalListingRequestSectionProps {
  listingId: string;
  isAuthenticated: boolean;
  /** When false, show notice instead of the request form. */
  merchantCanAcceptOrders?: boolean;
  minRentalHours?: number;
  maxRentalHours?: number | null;
  unitsAvailable?: number;
  weeklyAvailability?: WeeklyRow[];
  basePricePerHour?: number;
  basePricePerDay?: number;
  currency?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  cardWindow?: CardWindowFields | null;
  inspectionPolicyVersion?: number | null;
  /** Listing switches; missing means both on. */
  offersDaily?: boolean;
  offersHourly?: boolean;
  /** Listing market time zone (floating wall-clock times). */
  timeZone?: string | null;
  city?: string | null;
}

export const RentalListingRequestSection: React.FC<RentalListingRequestSectionProps> = ({
  listingId,
  isAuthenticated,
  merchantCanAcceptOrders = true,
  minRentalHours = 1,
  maxRentalHours = null,
  unitsAvailable = 1,
  weeklyAvailability = [],
  basePricePerHour = 0,
  basePricePerDay = 0,
  currency = 'XAF',
  initialStartDate,
  initialEndDate,
  cardWindow = null,
  inspectionPolicyVersion = null,
  offersDaily,
  offersHourly,
  timeZone = null,
  city = null,
}) => {
  const { t, i18n } = useTranslation();
  const { flags } = useClientFlags();
  const guardOn = flags.rentals_card_window_guard_enabled;
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Server rule text shown inside the reopened picker, not on the page behind it. */
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [payingByCard, setPayingByCard] = useState<boolean | null>(null);
  const [cardFallback, setCardFallback] = useState<string | null>(null);
  const cardOn = payingByCard ?? cardWindow?.payment_rail === 'stripe';
  const latest = guardOn ? effectiveCardEnd(cardWindow, cardOn) : null;
  const navigate = useNavigate();
  const { createRequest, fetchListingBookedWindows } = useRentalApi();
  const { trackSiteEvent } = useTrackSiteEvent();
  const [booked, setBooked] = useState<RentalTakenWindow[]>([]);
  const [selections, setSelections] = useState<SelectionRange[]>([]);
  const [unitsRequested, setUnitsRequested] = useState(1);
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const seededDates = useRef(false);

  useEffect(() => {
    if (seededDates.current || !initialStartDate || !initialEndDate || initialEndDate <= initialStartDate) return;
    seededDates.current = true;
    const ranges = exclusiveDays(initialStartDate, initialEndDate).map((day) => ({
      id: `prefill-${day}`,
      startMs: Date.parse(`${day}T08:00:00`),
      endMs: Date.parse(`${day}T18:00:00`),
      billing: 'all_day' as const,
      calendarDate: day,
    }));
    if (!ranges.length) return;
    setSelections(ranges);
    document.getElementById(RENTAL_REQUEST_SECTION_ID)?.scrollIntoView({ behavior: 'smooth' });
  }, [initialEndDate, initialStartDate]);

  const stock = Math.max(1, Math.floor(Number(unitsAvailable)) || 1);
  const dayHoursModel = useMemo(
    () =>
      dayHoursListingModel({
        weeklyAvailability,
        booked,
        unitsAvailable: stock,
        minRentalHours,
        maxRentalHours,
        basePricePerDay,
        basePricePerHour,
        offersDaily,
        offersHourly,
      }),
    [basePricePerDay, basePricePerHour, booked, maxRentalHours, minRentalHours, offersDaily, offersHourly, stock, weeklyAvailability]
  );
  const listingZone = timeZone ?? cardWindow?.timezone ?? null;
  const pickerDays = useMemo(
    () => (pickerOpen ? fromSelectionRanges(selections, dayHoursModel, listingNowMs(Date.now(), listingZone)) : []),
    [dayHoursModel, listingZone, pickerOpen, selections]
  );

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

  const remainingForSelection = useMemo(() => {
    if (selections.length === 0) return stock;
    let minRem = stock;
    for (const r of selections) {
      const rem = remainingUnitsInRange(r.startMs, r.endMs, booked, stock);
      if (rem < minRem) minRem = rem;
    }
    return minRem;
  }, [booked, selections, stock]);

  useEffect(() => {
    setUnitsRequested((prev) => Math.min(Math.max(1, prev), Math.max(1, remainingForSelection)));
  }, [remainingForSelection]);

  const hoursTotal = useMemo(() => totalBillableHours(selections), [selections]);
  const { lines: estimateLines, total: estimatedTotal } = useMemo(
    () =>
      estimateTotalFromSelectionRanges(
        selections,
        basePricePerHour,
        basePricePerDay,
        unitsRequested
      ),
    [basePricePerDay, basePricePerHour, selections, unitsRequested]
  );

  const selectionEnd = useMemo(() => {
    if (!selections.length) return null;
    const ends = selections.map((row) => {
      const end = localPickerInstantToRequestParts(row.endMs);
      return Date.parse(requestedSlotUtcIso(end.dateKey, end.hour, end.minute));
    });
    return new Date(Math.max(...ends)).toISOString();
  }, [selections]);
  const cutoff = latest && cardWindow?.timezone
    ? formatCardCutoff(latest, cardWindow.timezone, i18n.language)
    : '';
  const cardUnfit = cardEndMisses(selectionEnd, latest);

  const validateBeforeSubmit = useCallback((): string | null => {
    if (cardUnfit) return t('rentals.cardWindow.sendReason', cardWindowSendReason(i18n.language));
    if (selections.length === 0) {
      return t('rentals.requestForm.addOneRange', 'Add at least one time range.');
    }
    const blockError = dayHoursBlockError(selections, minRentalHours, maxRentalHours);
    if (blockError === 'min') return t('rentals.requestForm.belowMinHours', 'Selected time is below minimum hours.');
    if (blockError === 'max') return t('rentals.requestForm.aboveMaxHours', 'Selected time exceeds maximum hours.');
    if (unitsRequested < 1 || unitsRequested > remainingForSelection) {
      return t(
        'rentals.requestForm.unitsUnavailable',
        'Not enough units available for the selected times.'
      );
    }
    for (const r of selections) {
      if (r.billing === 'all_day') {
        if (!r.calendarDate) {
          return t('rentals.requestForm.allDayNeedsDate', 'All-day selection is missing a date.');
        }
      }
      if (remainingUnitsInRange(r.startMs, r.endMs, booked, stock) < unitsRequested) {
        return t(
          'rentals.requestForm.unitsUnavailable',
          'Not enough units available for the selected times.'
        );
      }
    }
    return null;
  }, [
    booked,
    hoursTotal,
    maxRentalHours,
    minRentalHours,
    remainingForSelection,
    selections,
    stock,
    t,
    unitsRequested,
    cardUnfit,
    i18n.language,
  ]);

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
      const created = await createRequest({
        rentalLocationListingId: listingId,
        requestedStartAt: requestedSlotUtcIso(envS.dateKey, envS.hour, envS.minute),
        requestedEndAt: requestedSlotUtcIso(envE.dateKey, envE.hour, envE.minute),
        windows,
        unitsRequested,
        clientRequestNote: notes.trim() || undefined,
      });
      const attribution = consumeRentalRequestAttribution(listingId);
      if (attribution) {
        void trackSiteEvent({
          eventType: SITE_EVENT_ASSISTANT_RENTAL_REQUEST_CREATED,
          metadata: {
            thread_id: attribution.threadId,
            listing_id: listingId,
            minutes_since_tap: attribution.minutes,
          },
        });
      }
      setConfirmOpen(false);
      void loadBooked();
      const version = created.inspection_policy_version ?? inspectionPolicyVersion;
      navigate(`/rentals/request-submitted?requestId=${encodeURIComponent(created.requestId)}`, {
        state: { inspectionPolicyVersion: version, requestId: created.requestId },
      });
    } catch (e: unknown) {
      const ruleText = submitRuleText(e, i18n.language);
      if (ruleText) {
        // Day-and-hours rule (for example the 2 h lead time): say why and reopen the picker.
        setConfirmOpen(false);
        setCardFallback(null);
        setMsg(null);
        setPickerError(ruleText);
        setPickerOpen(true);
        return;
      }
      const friendly = cardWindowErrorMessage(e, i18n.language);
      setCardFallback(friendly);
      const http = e as { response?: { data?: { message?: string } } };
      setMsg(
        friendly
          ? null
          : http?.response?.data?.message ||
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
            {!merchantCanAcceptOrders ? (
              <Alert severity="info">
                {t(
                  'checkout.merchantNotAcceptingOrders',
                  'This merchant is currently completing account setup and is not yet accepting orders.'
                )}
              </Alert>
            ) : isAuthenticated ? (
              <Stack spacing={2.5} sx={{ width: '100%', maxWidth: '100%' }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {t('rentals.requestRental', 'Request this rental')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('rentals.dayHours.sectionSubtitle', 'Pick the days you need: a full day or just a few hours.')}
                  </Typography>
                </Box>
                {guardOn && cardWindow ? (
                  <CardWindowCalendar
                    fields={{ ...cardWindow, latest_card_end_at: latest }}
                    payingByCard={cardOn}
                    locale={i18n.language}
                    onPayWithMomo={cardWindow.momo_available ? () => setPayingByCard(false) : undefined}
                  />
                ) : null}
                {cardUnfit ? (
                  <CardWindowBanner
                    tone="warn"
                    body={cardWindowWarning(cutoff, i18n.language)}
                    action={i18n.language.startsWith('fr') ? 'Modifier les dates' : 'Change dates'}
                    onAction={() => setPickerOpen(true)}
                  />
                ) : null}
                {cardFallback ? (
                  <CardWindowBanner
                    tone="error"
                    title={i18n.language.startsWith('fr') ? 'Impossible de continuer' : 'Can’t continue with these dates'}
                    body={cardFallback}
                    action={i18n.language.startsWith('fr') ? 'Modifier les dates' : 'Change dates'}
                    onAction={() => setCardFallback(null)}
                  />
                ) : null}

                <Button
                  data-testid="day-hours-open"
                  variant={selections.length ? 'outlined' : 'contained'}
                  size="large"
                  startIcon={<EditCalendarOutlinedIcon />}
                  onClick={() => setPickerOpen(true)}
                  sx={{ minHeight: 48, fontWeight: 700, borderRadius: 2, alignSelf: { sm: 'flex-start' } }}
                >
                  {selections.length
                    ? t('rentals.dayHours.changeDays', 'Change days and hours')
                    : t('rentals.dayHours.pickDays', 'Pick days and hours')}
                </Button>

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
                                        rate: formatCatalogMoney(basePricePerHour, currency, i18n.language),
                                      })}
                                </Typography>
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{ ml: 1, fontWeight: 800, color: 'success.dark' }}
                                >
                                  {formatCatalogMoney(estimateLines[idx]?.subtotal ?? 0, currency, i18n.language)}
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                    <TextField
                      label={t('rentals.requestForm.units', 'Quantity')}
                      type="number"
                      size="small"
                      value={unitsRequested}
                      onChange={(e) => {
                        const n = Math.floor(Number(e.target.value));
                        if (!Number.isFinite(n)) return;
                        setUnitsRequested(Math.min(Math.max(1, n), Math.max(1, remainingForSelection)));
                      }}
                      inputProps={{ min: 1, max: Math.max(1, remainingForSelection) }}
                      helperText={t(
                        'rentals.requestForm.unitsRemaining',
                        '{{remaining}} of {{total}} available for your selected times',
                        { remaining: remainingForSelection, total: stock }
                      )}
                      sx={{ maxWidth: 280 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {t('rentals.requestForm.runningTotal', 'Estimated total')}:{' '}
                      <strong>{formatCatalogMoney(estimatedTotal, currency, i18n.language)}</strong>
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

                {cardUnfit || cardFallback ? (
                  <Typography sx={{ color: '#B45309', fontWeight: 600 }}>
                    {t('rentals.cardWindow.sendReason', cardWindowSendReason(i18n.language))}
                  </Typography>
                ) : null}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => openConfirm()}
                    disabled={selections.length === 0 || cardUnfit || Boolean(cardFallback)}
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

      <RentalDayHoursDialog
        open={pickerOpen}
        listing={dayHoursModel}
        currency={currency}
        language={i18n.language}
        timeZone={listingZone}
        city={city}
        initialDays={pickerDays}
        serverError={pickerError}
        onClose={() => {
          setPickerError(null);
          setPickerOpen(false);
        }}
        onContinue={(rows) => {
          setPickerError(null);
          setMsg(null);
          setCardFallback(null);
          setSelections(rows);
          setPickerOpen(false);
        }}
      />
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
                          rate: formatCatalogMoney(line.ratePerHour, currency, i18n.language),
                        })
                  }
                  secondary={formatCatalogMoney(line.subtotal, currency, i18n.language)}
                />
              </ListItem>
            ))}
          </List>
          <Typography variant="body1" fontWeight={600} sx={{ mt: 1 }}>
            {t('rentals.requestForm.confirmHours', 'Total hours')}: {hoursTotal}
          </Typography>
          <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5 }}>
            {t('rentals.requestForm.confirmUnits', 'Quantity')}: {unitsRequested}
          </Typography>
          <Typography variant="h6" fontWeight={800} color="primary" sx={{ mt: 1 }}>
            {t('rentals.requestForm.confirmPrice', 'Estimated price')}: {formatCatalogMoney(estimatedTotal, currency, i18n.language)}
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
          {cardUnfit || cardFallback ? (
            <Typography sx={{ color: '#B45309', fontWeight: 600, mr: 'auto' }}>
              {t('rentals.cardWindow.sendReason', cardWindowSendReason(i18n.language))}
            </Typography>
          ) : null}
          <Button variant="contained" onClick={() => void submitRequest()} disabled={submitting || cardUnfit || Boolean(cardFallback)}>
            {submitting ? t('common.loading', 'Loading...') : t('rentals.requestForm.confirmSend', 'Send request')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
