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
import { RichTextEditor } from '../common/RichTextEditor';
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
  return rentalHours(req.requested_start_at, req.requested_end_at);
}

function buildPricingSnapshot(req: BusinessRentalRequestRow): RentalPricingSnapshotBody {
  const weekly = req.rental_location_listing.weekly_availability ?? [];
  const windows = parseRentalSelectionWindowsFromJson(
    req.rental_selection_windows,
    req.requested_start_at,
    req.requested_end_at
  );
  const ratePerHour = Number(req.rental_location_listing.base_price_per_hour);
  const ratePerDay = Number(req.rental_location_listing.base_price_per_day ?? 0);
  const { lines, total } = computeRentalPricingLines(
    windows,
    weekly,
    ratePerHour,
    ratePerDay
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

function formatDateTimeWithoutTimezone(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface BusinessRentalRespondDialogProps {
  open: boolean;
  mode: 'available' | 'unavailable' | null;
  request: BusinessRentalRequestRow | null;
  onClose: () => void;
  onSuccess: () => void;
  respondRequest: (id: string, body: RespondRentalRequestBody) => Promise<{ success: boolean }>;
}

export const BusinessRentalRespondDialog: React.FC<BusinessRentalRespondDialogProps> = ({
  open,
  mode,
  request,
  onClose,
  onSuccess,
  respondRequest,
}) => {
  const { t } = useTranslation();
  const [contractHours, setContractHours] = useState('48');
  const [availableNote, setAvailableNote] = useState('');
  const [reasonCode, setReasonCode] = useState<UnavailableRentalReasonCode | ''>('');
  const [unavailableNote, setUnavailableNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setContractHours('48');
    setAvailableNote('');
    setReasonCode('');
    setUnavailableNote('');
    setError(null);
  }, [open, request?.id, mode]);

  const submitAvailable = useCallback(async () => {
    if (!request) return;
    const h = parseInt(contractHours, 10);
    if (!Number.isInteger(h) || h < 1 || h > 168) {
      setError(t('business.rentals.respondValidationHours', 'Enter a whole number of hours between 1 and 168.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const snap = buildPricingSnapshot(request);
      await respondRequest(request.id, {
        status: 'available',
        rentalPricingSnapshot: snap,
        contractExpiryHours: h,
        businessResponseNote: availableNote.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('business.rentals.respondFailed', 'Could not send response');
      setError(typeof msg === 'string' ? msg : String(msg));
    } finally {
      setSubmitting(false);
    }
  }, [availableNote, contractHours, onClose, onSuccess, request, respondRequest, t]);

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
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('business.rentals.respondFailed', 'Could not send response');
      setError(typeof msg === 'string' ? msg : String(msg));
    } finally {
      setSubmitting(false);
    }
  }, [onClose, onSuccess, reasonCode, request, respondRequest, t, unavailableNote]);

  const offerPreview = useMemo(() => {
    if (!request || mode !== 'available') return null;
    try {
      const weekly = request.rental_location_listing.weekly_availability ?? [];
      const windows = parseRentalSelectionWindowsFromJson(
        request.rental_selection_windows,
        request.requested_start_at,
        request.requested_end_at
      );
      const ratePerHour = Number(request.rental_location_listing.base_price_per_hour);
      const ratePerDay = Number(request.rental_location_listing.base_price_per_day ?? 0);
      const { lines, total } = computeRentalPricingLines(
        windows,
        weekly,
        ratePerHour,
        ratePerDay
      );
      const hours = totalRentalHoursForRequest(request);
      return { ok: true as const, lines, total, hours, cur: request.rental_location_listing.rental_item.currency };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, message: msg };
    }
  }, [mode, request]);

  if (!open || !mode || !request) return null;

  const title =
    mode === 'available'
      ? t('business.rentals.respondDialogTitleAvailable', 'Confirm availability')
      : t('business.rentals.respondDialogTitleUnavailable', 'Mark unavailable');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {request.rental_location_listing.rental_item.name}
        </Typography>
        <Typography variant="body2">
          {formatDateTimeWithoutTimezone(request.requested_start_at)} ->{' '}
          {formatDateTimeWithoutTimezone(request.requested_end_at)}
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
                      ? t('rentals.requestForm.lineAllDay', 'Full day {{date}}', {
                          date: line.calendarDate,
                        })
                      : t('rentals.requestForm.lineHourly', '{{h}} h × {{rate}}', {
                          h: line.billableHours,
                          rate: formatMoney(line.ratePerHour, offerPreview.cur),
                        })}{' '}
                    — {formatMoney(line.subtotal, offerPreview.cur)}
                  </Typography>
                ))}
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {t('business.rentals.contractBillableHoursTotal', '{{count}} total billable hours', {
                    count: offerPreview.hours,
                  })}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {t('business.rentals.contractTotal', 'Total')}:{' '}
                  {formatMoney(offerPreview.total, offerPreview.cur)}
                </Typography>
              </>
            ) : null}
            <TextField
              label={t(
                'business.rentals.contractExpiryHoursLabel',
                'Client must confirm within (hours)'
              )}
              type="number"
              value={contractHours}
              onChange={(e) => setContractHours(e.target.value)}
              inputProps={{ min: 1, max: 168 }}
              helperText={t(
                'business.rentals.contractExpiryHelper',
                'Between 1 and 168 hours (1 week).'
              )}
              fullWidth
            />
            <Typography variant="body2" color="text.secondary">
              {t('business.rentals.optionalMessage', 'Optional message to the client')}
            </Typography>
            <RichTextEditor
              value={availableNote}
              onChange={setAvailableNote}
              placeholder={t('business.rentals.optionalMessage', 'Optional message to the client')}
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
            <Typography variant="body2" color="text.secondary">
              {reasonCode === 'other'
                ? t('business.rentals.otherReasonNote', 'Please explain')
                : t('business.rentals.optionalMessage', 'Optional message to the client')}
            </Typography>
            <RichTextEditor
              value={unavailableNote}
              onChange={setUnavailableNote}
              placeholder={
                reasonCode === 'other'
                  ? t('business.rentals.otherReasonNote', 'Please explain')
                  : t('business.rentals.optionalMessage', 'Optional message to the client')
              }
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
          disabled={
            submitting ||
            (mode === 'available' && offerPreview != null && !offerPreview.ok)
          }
          onClick={() => void (mode === 'available' ? submitAvailable() : submitUnavailable())}
        >
          {t('business.rentals.submitResponse', 'Send response')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
