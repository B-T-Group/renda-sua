import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  TextField,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { contractHoursOffer, requestStartIso, totalOverrideTooHigh } from '../../utils/dashboardRentalRequests';
import { cardWindowErrorMessage } from '../../utils/rentals/cardWindow';
import { buildRequestCardModel } from '../../utils/rentalRequestCardModel';
import type {
  BusinessRentalRequestRow,
  RentalPricingSnapshotBody,
  RespondRentalRequestBody,
  UnavailableRentalReasonCode,
} from '../../hooks/useRentalApi';
import {
  computeRentalPricingLines,
  parseRentalSelectionWindowsFromJson,
} from '../../utils/rentalPricingLines';
import { formatRequestAmount } from '../../utils/rentalRequestDisplay';
import { formatRentalDay } from '../../utils/rentalRequestFormat';
import { useClientFlags } from '../../hooks/useClientFlags';

function isStaleVersion(error: unknown): boolean {
  const data = (error as { response?: { data?: { code?: string } } })?.response?.data;
  return data?.code === 'RENTAL_REQUEST_STALE_VERSION';
}

const REASON_CODES: UnavailableRentalReasonCode[] = [
  'fully_booked',
  'dates_not_available',
  'item_unavailable',
  'pricing_mismatch',
  'other',
];

function rentalHours(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.ceil((e - s) / 3600000));
}

function totalRentalHoursForRequest(req: BusinessRentalRequestRow): number {
  const raw = req.rental_selection_windows;
  if (Array.isArray(raw) && raw.length > 0) {
    let sum = 0;
    for (const w of raw as { start_at: string; end_at: string }[]) {
      sum += rentalHours(w.start_at, w.end_at);
    }
    return sum;
  }
  return 0;
}

function parseTotalOverride(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return 'invalid';
  return Number(value.toFixed(2));
}

function buildPricingSnapshot(req: BusinessRentalRequestRow): RentalPricingSnapshotBody {
  const windows = parseRentalSelectionWindowsFromJson(
    req.rental_selection_windows
  );
  const ratePerHour = Number(req.rental_location_listing.base_price_per_hour);
  const ratePerDay = Number(req.rental_location_listing.base_price_per_day ?? 0);
  const units = Math.max(1, Math.floor(Number(req.units_requested)) || 1);
  const { lines, total } = computeRentalPricingLines(
    windows,
    ratePerHour,
    ratePerDay,
    units
  );
  const cur = req.rental_location_listing.rental_item.currency;
  return {
    version: 3,
    currency: cur,
    total,
    lines,
    computedAt: new Date().toISOString(),
  };
}

function formatMoney(amount: number, currency: string, language: string): string {
  return formatRequestAmount(amount, currency, language);
}

const declineButtonSx = {
  bgcolor: 'error.main',
  color: 'common.white',
  '&:hover': { bgcolor: 'error.dark' },
  '&.Mui-disabled': { bgcolor: 'error.main', color: 'common.white', opacity: 0.72 },
};

function declineBlocked(
  mode: 'available' | 'unavailable' | null,
  reason: UnavailableRentalReasonCode | '',
  note: string
): boolean {
  if (mode !== 'unavailable') return false;
  if (!reason) return true;
  return reason === 'other' && !note.trim();
}

export interface BusinessRentalRespondDialogProps {
  open: boolean;
  mode: 'available' | 'unavailable' | null;
  request: BusinessRentalRequestRow | null;
  onClose: () => void;
  onSuccess: () => void;
  onStale?: () => void;
  respondRequest: (id: string, body: RespondRentalRequestBody) => Promise<{ success: boolean }>;
}

export const BusinessRentalRespondDialog: React.FC<BusinessRentalRespondDialogProps> = ({
  open,
  mode,
  request,
  onClose,
  onSuccess,
  onStale,
  respondRequest,
}) => {
  const { t, i18n } = useTranslation();
  const { flags } = useClientFlags();
  const canChangeTotal =
    flags.rentals_dashboard_requests_enabled && flags.rentals_modify_request_enabled;
  const [contractHours, setContractHours] = useState('48');
  const [availableNote, setAvailableNote] = useState('');
  const [reasonCode, setReasonCode] = useState<UnavailableRentalReasonCode | ''>('');
  const [unavailableNote, setUnavailableNote] = useState('');
  const [totalOverride, setTotalOverride] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startIso = request ? requestStartIso(request) : null;
  const hourOffer = contractHoursOffer(startIso);

  useEffect(() => {
    if (!open) return;
    const offer = contractHoursOffer(startIso);
    setContractHours(String(offer.hidden ? 1 : offer.hours));
    setTotalOverride('');
    setAvailableNote('');
    setReasonCode('');
    setUnavailableNote('');
    setError(null);
  }, [open, request?.id, mode, startIso]);

  const submitAvailable = useCallback(async () => {
    if (!request) return;
    const offer = contractHoursOffer(requestStartIso(request));
    const h = offer.hidden ? 1 : parseInt(contractHours, 10);
    if (!offer.hidden && (!Number.isInteger(h) || h < 1 || h > offer.maxHours)) {
      setError(t('business.rentals.respondValidationHours', 'Enter a whole number of hours from 1 to {{count}}.', { count: offer.maxHours }));
      return;
    }
    const overridden = parseTotalOverride(totalOverride);
    const quote = buildPricingSnapshot(request).total;
    const tooHigh = typeof overridden === 'number' && totalOverrideTooHigh(quote, overridden);
    if (overridden === 'invalid' || tooHigh) {
      setError(overridden === 'invalid'
        ? t('business.rentals.changeTotalInvalid', 'Enter a total greater than zero.')
        : t('business.rentals.changeTotalTooHigh', 'Enter a total no more than 10 times the quote, and at most 1000000.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const snap = buildPricingSnapshot(request);
      await respondRequest(request.id, {
        status: 'available',
        rentalPricingSnapshot: snap,
        totalOverride: canChangeTotal && overridden != null ? overridden : undefined,
        contractExpiryHours: h,
        businessResponseNote: availableNote.trim() || undefined,
        expectedVersion: request.edit_version ?? 1,
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      if (isStaleVersion(e)) {
        onStale?.();
        onClose();
        return;
      }
      const msg =
        cardWindowErrorMessage(e, i18n.language) ||
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('business.rentals.respondFailed', 'Could not send response');
      setError(typeof msg === 'string' ? msg : String(msg));
    } finally {
      setSubmitting(false);
    }
  }, [availableNote, canChangeTotal, contractHours, i18n.language, onClose, onStale, onSuccess, request, respondRequest, t, totalOverride]);

  const submitUnavailable = useCallback(async () => {
    if (!request) return;
    if (!reasonCode) {
      setError(t('business.rentals.respondValidationReason', 'Choose a reason.'));
      return;
    }
    if (reasonCode === 'other' && !unavailableNote.trim()) {
      setError(t('business.rentals.respondValidationOtherNote', 'Please add a short explanation.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await respondRequest(request.id, {
        status: 'unavailable',
        unavailableReasonCode: reasonCode,
        businessResponseNote: unavailableNote.trim() || undefined,
        expectedVersion: request.edit_version ?? 1,
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      if (isStaleVersion(e)) {
        onStale?.();
        onClose();
        return;
      }
      const msg =
        cardWindowErrorMessage(e, i18n.language) ||
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('business.rentals.respondFailed', 'Could not send response');
      setError(typeof msg === 'string' ? msg : String(msg));
    } finally {
      setSubmitting(false);
    }
  }, [onClose, onStale, onSuccess, reasonCode, request, respondRequest, t, unavailableNote]);

  const offerPreview = useMemo(() => {
    if (!request || mode !== 'available') return null;
    try {
      const windows = parseRentalSelectionWindowsFromJson(
        request.rental_selection_windows
      );
      const ratePerHour = Number(request.rental_location_listing.base_price_per_hour);
      const ratePerDay = Number(request.rental_location_listing.base_price_per_day ?? 0);
      const units = Math.max(1, Math.floor(Number(request.units_requested)) || 1);
      const { lines, total } = computeRentalPricingLines(
        windows,
        ratePerHour,
        ratePerDay,
        units
      );
      const hours = totalRentalHoursForRequest(request);
      return { ok: true as const, lines, total, hours, cur: request.rental_location_listing.rental_item.currency };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, message: msg };
    }
  }, [mode, request]);

  const typedOverride = typeof parseTotalOverride(totalOverride) === 'number' ? parseTotalOverride(totalOverride) as number : null;
  const quoteTotal = offerPreview?.ok ? offerPreview.total : 0;
  const overrideTooHigh = typedOverride != null && totalOverrideTooHigh(quoteTotal, typedOverride);

  if (!open || !mode || !request) return null;

  const title =
    mode === 'available'
      ? t('business.rentals.respondDialogTitleAvailable', 'Confirm availability')
      : t('business.rentals.respondDialogTitleUnavailable', 'Decline request');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {request.rental_location_listing.rental_item.name}
        </Typography>
        <Typography variant="body2">
          {buildRequestCardModel(request, i18n.language, new Date(), t).schedule.summary
            || t('rentals.clientRequests.unknownPeriod', 'Requested period unavailable')}
        </Typography>

        {mode === 'available' ? (
          <>
            <Typography variant="subtitle2">
              {t('business.rentals.contractSummary', 'Offer summary')}
            </Typography>
            {offerPreview && !offerPreview.ok ? (
              <Typography variant="body2" color="error">
                {offerPreview.message}
              </Typography>
            ) : null}
            {offerPreview?.ok ? (
              <>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                  {t('rentals.requestForm.priceBreakdown', 'Price breakdown')}
                </Typography>
                {offerPreview.lines.map((line, idx) => (
                  <Typography key={idx} variant="body2">
                    {line.kind === 'all_day'
                      ? t('business.rentals.offerLineAllDay', 'Full day · {{date}}', {
                          date: formatRentalDay(line.calendarDate, i18n.language),
                        })
                      : t('rentals.requestForm.lineHourly', '{{h}} h × {{rate}}', {
                          h: line.billableHours,
                          rate: formatMoney(line.ratePerHour, offerPreview.cur, i18n.language),
                        })}{' '}
                    — {formatMoney(line.subtotal, offerPreview.cur, i18n.language)}
                  </Typography>
                ))}
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {t('business.rentals.contractBillableHoursTotal', '{{count}} total billable hours', {
                    count: offerPreview.hours,
                  })}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {t('business.rentals.contractTotal', 'Total')}:{' '}
                  {formatMoney(offerPreview.total, offerPreview.cur, i18n.language)}
                </Typography>
              </>
            ) : null}
            {canChangeTotal ? (
            <TextField
              label={t('business.rentals.changeTotalLabel', 'Change total (optional)')}
              type="number"
              value={totalOverride}
              onChange={(e) => setTotalOverride(e.target.value)}
              inputProps={{ min: 0.01, max: 1000000, step: '0.01' }}
              error={overrideTooHigh}
              helperText={overrideTooHigh
                ? t('business.rentals.changeTotalTooHigh', 'Enter a total no more than 10 times the quote, and at most 1000000.')
                : t('business.rentals.changeTotalHelper', 'The renter’s quote is an estimate. If you change the total, they’ll be asked to review the new price before paying.')
              }
              fullWidth
            />
            ) : null}
            {hourOffer.hidden ? null : (
              <TextField
                label={t('business.rentals.contractExpiryHoursLabel', 'Contract valid for (hours)')}
                type="number"
                value={contractHours}
                onChange={(e) => setContractHours(e.target.value)}
                inputProps={{ min: 1, max: hourOffer.maxHours, step: 1 }}
                helperText={t('business.rentals.contractExpiryHelper', 'Up to {{count}} hours, and not past the start.', { count: hourOffer.maxHours })}
                fullWidth
              />
            )}
            <TextField
              label={t('business.rentals.optionalMessage', 'Optional message to the client')}
              value={availableNote}
              onChange={(e) => setAvailableNote(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
          </>
        ) : (
          <>
            <FormControl fullWidth>
              <InputLabel id="unavail-reason-label">
                {t('business.rentals.unavailableReasonLabel', 'Reason')}
              </InputLabel>
              <Select
                labelId="unavail-reason-label"
                label={t('business.rentals.unavailableReasonLabel', 'Reason')}
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as UnavailableRentalReasonCode)}
              >
                {REASON_CODES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {t(`rentals.unavailableReasons.${c}`, c)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={
                reasonCode === 'other'
                  ? t('business.rentals.otherReasonNote', 'Please explain')
                  : t('business.rentals.optionalMessage', 'Optional message to the client')
              }
              value={unavailableNote}
              onChange={(e) => setUnavailableNote(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
          </>
        )}

        {error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          color={mode === 'unavailable' ? 'error' : 'primary'}
          disabled={
            submitting ||
            declineBlocked(mode, reasonCode, unavailableNote) ||
            (mode === 'available' && offerPreview != null && !offerPreview.ok) ||
            (mode === 'available' && overrideTooHigh)
          }
          onClick={() => void (mode === 'available' ? submitAvailable() : submitUnavailable())}
          sx={mode === 'unavailable' ? declineButtonSx : undefined}
        >
          {mode === 'available'
            ? t('business.rentals.accept', 'Accept')
            : t('business.rentals.decline', 'Decline')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
