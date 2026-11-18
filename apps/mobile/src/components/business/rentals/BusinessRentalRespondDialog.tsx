import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  Menu,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import type {
  BusinessRentalRequestRow,
  UnavailableRentalReasonCode,
} from '../../../types/rentals';
import { cardWindowErrorMessage } from '../../../utils/rentals/cardWindow';
import {
  computeRentalPricingLines,
  parseRentalSelectionWindowsFromJson,
} from '../../../utils/rentals';
import { formatRequestAmount } from '../../../utils/rentals/rentalRequestFormat';
import { contractHoursOffer, requestStartIso } from '../../../utils/rentals/dashboardRentalRequests';
import { buildRequestCardModel } from '../../../utils/rentals/rentalRequestCardModel';
import { useTheme } from '../../../contexts/ThemeContext';
import { useClientFlags } from '../../../contexts/ClientFlagsContext';
import { rentalsApi } from '../../../services/rentalsApi';

function isStaleVersion(error: unknown): boolean {
  return (error as { code?: string }).code === 'RENTAL_REQUEST_STALE_VERSION';
}

const REASON_CODES: UnavailableRentalReasonCode[] = [
  'fully_booked',
  'dates_not_available',
  'item_unavailable',
  'pricing_mismatch',
  'other',
];

export interface BusinessRentalRespondDialogProps {
  visible: boolean;
  mode: 'available' | 'unavailable' | null;
  request: BusinessRentalRequestRow | null;
  onDismiss: () => void;
  onSuccess: () => void;
  onStale?: () => void;
}

function parseTotalOverride(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return 'invalid';
  return Number(value.toFixed(2));
}

function buildPricingSnapshot(req: BusinessRentalRequestRow) {
  const windows = parseRentalSelectionWindowsFromJson(req.rental_selection_windows);
  const ratePerHour = Number(req.rental_location_listing.base_price_per_hour);
  const ratePerDay = Number(req.rental_location_listing.base_price_per_day ?? 0);
  const units = Math.max(1, Math.floor(Number(req.units_requested)) || 1);
  const { lines, total } = computeRentalPricingLines(windows, ratePerHour, ratePerDay, units);
  return {
    version: 3,
    currency: req.rental_location_listing.rental_item.currency,
    total,
    lines,
    computedAt: new Date().toISOString(),
  };
}

export function BusinessRentalRespondDialog({
  visible,
  mode,
  request,
  onDismiss,
  onSuccess,
  onStale,
}: BusinessRentalRespondDialogProps) {
  const { t, i18n } = useTranslation();
  const { flags } = useClientFlags();
  const canChangeTotal = flags.rentals_dashboard_requests_enabled;
  const { colors } = useTheme();
  const [contractHours, setContractHours] = useState('48');
  const [totalOverride, setTotalOverride] = useState('');
  const [availableNote, setAvailableNote] = useState('');
  const [reasonCode, setReasonCode] = useState<UnavailableRentalReasonCode | ''>('');
  const [unavailableNote, setUnavailableNote] = useState('');
  const [reasonMenu, setReasonMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startIso = request ? requestStartIso(request) : null;
  const hourOffer = contractHoursOffer(startIso);

  useEffect(() => {
    if (!visible) return;
    const offer = contractHoursOffer(startIso);
    setContractHours(String(offer.hidden ? 1 : offer.hours));
  }, [startIso, visible]);

  const offerPreview = useMemo(() => {
    if (!request || mode !== 'available') return null;
    try {
      return buildPricingSnapshot(request);
    } catch {
      return null;
    }
  }, [mode, request]);

  const resetAndClose = useCallback(() => {
    setContractHours(String(contractHoursOffer(request ? requestStartIso(request) : null).hours || 1));
    setTotalOverride('');
    setAvailableNote('');
    setReasonCode('');
    setUnavailableNote('');
    setError(null);
    onDismiss();
  }, [onDismiss, request]);

  const submitAvailable = useCallback(async () => {
    if (!request) return;
    const offer = contractHoursOffer(requestStartIso(request));
    const h = offer.hidden ? 1 : parseInt(contractHours, 10);
    if (!offer.hidden && (!Number.isInteger(h) || h < 1 || h > offer.maxHours)) {
      setError(t('business.rentals.respondValidationHours', 'Enter a whole number of hours from 1 to {{count}}.', { count: offer.maxHours }));
      return;
    }
    const overridden = parseTotalOverride(totalOverride);
    if (overridden === 'invalid') {
      setError(t('business.rentals.changeTotalInvalid', 'Enter a total greater than zero.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const snap = buildPricingSnapshot(request);
      await rentalsApi.respondToRequest(request.id, {
        status: 'available',
        rentalPricingSnapshot: snap,
        totalOverride: canChangeTotal && overridden != null ? overridden : undefined,
        contractExpiryHours: h,
        businessResponseNote: availableNote.trim() || undefined,
        expectedVersion: request.edit_version ?? 1,
      });
      onSuccess();
      resetAndClose();
    } catch (e: unknown) {
      if (isStaleVersion(e)) {
        onStale?.();
        resetAndClose();
        return;
      }
      setError(respondErrorText(e, i18n.language, t));
    } finally {
      setSubmitting(false);
    }
  }, [availableNote, canChangeTotal, contractHours, i18n.language, onStale, onSuccess, request, resetAndClose, t, totalOverride]);

  const submitUnavailable = useCallback(async () => {
    if (!request) return;
    if (!reasonCode) {
      setError(t('business.rentals.respondValidationReason', 'Choose a reason.'));
      return;
    }
    if (reasonCode === 'other' && !unavailableNote.trim()) {
      setError(
        t(
          'business.rentals.respondValidationOtherNote',
          'Please add a short explanation.'
        )
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await rentalsApi.respondToRequest(request.id, {
        status: 'unavailable',
        unavailableReasonCode: reasonCode,
        businessResponseNote: unavailableNote.trim() || undefined,
        expectedVersion: request.edit_version ?? 1,
      });
      onSuccess();
      resetAndClose();
    } catch (e: unknown) {
      if (isStaleVersion(e)) {
        onStale?.();
        resetAndClose();
        return;
      }
      setError(respondErrorText(e, i18n.language, t));
    } finally {
      setSubmitting(false);
    }
  }, [i18n.language, onStale, onSuccess, reasonCode, request, resetAndClose, t, unavailableNote]);

  if (!mode) return null;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={resetAndClose}>
        <Dialog.Title>
          {mode === 'available'
            ? t('business.rentals.respondDialogTitleAvailable', 'Confirm availability')
            : t('business.rentals.respondDialogTitleUnavailable', 'Decline request')}
        </Dialog.Title>
        <Dialog.Content>
          <ScrollView style={{ maxHeight: 360 }}>
            {request ? (
              <Text variant="bodyMedium" style={{ marginBottom: 12, color: colors.text.secondary }}>
                {request.rental_location_listing.rental_item.name}
                {'\n'}
                {buildRequestCardModel(request, i18n.language, new Date(), t).schedule.summary}
              </Text>
            ) : null}

            {mode === 'available' ? (
              <View>
                {offerPreview ? (
                  <Text style={{ marginBottom: 8, color: colors.text.primary }}>
                    {t('business.rentals.offerTotal', 'Quoted total')}:{' '}
                    {formatRequestAmount(
                      offerPreview.total,
                      offerPreview.currency,
                      i18n.language
                    )}
                  </Text>
                ) : null}
                {canChangeTotal ? (
                <TextInput
                  label={t('business.rentals.changeTotalLabel', 'Change total (optional)')}
                  value={totalOverride}
                  onChangeText={setTotalOverride}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  style={styles.field}
                />
                ) : null}
                {canChangeTotal ? (
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 8 }}>
                  {t(
                    'business.rentals.changeTotalHelper',
                    'The renter’s quote is an estimate. If you change the total, they’ll be asked to review the new price before paying.'
                  )}
                </Text>
                ) : null}
                {hourOffer.hidden ? null : (
                  <TextInput
                    label={t('business.rentals.contractHours', 'Contract valid for (hours)')}
                    value={contractHours}
                    onChangeText={setContractHours}
                    keyboardType="number-pad"
                    mode="outlined"
                    style={styles.field}
                  />
                )}
                {hourOffer.hidden ? null : (
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {t('business.rentals.contractExpiryHelper', 'Up to {{count}} hours, and not past the start.', { count: hourOffer.maxHours })}
                  </Text>
                )}
                <TextInput
                  label={t('business.rentals.responseNote', 'Note (optional)')}
                  value={availableNote}
                  onChangeText={setAvailableNote}
                  mode="outlined"
                  multiline
                  style={styles.field}
                />
              </View>
            ) : (
              <View>
                <Menu
                  visible={reasonMenu}
                  onDismiss={() => setReasonMenu(false)}
                  anchor={
                    <Button mode="outlined" onPress={() => setReasonMenu(true)}>
                      {reasonCode
                        ? t(`rentals.unavailableReasons.${reasonCode}`, reasonCode)
                        : t('business.rentals.chooseReason', 'Choose a reason')}
                    </Button>
                  }
                >
                  {REASON_CODES.map((code) => (
                    <Menu.Item
                      key={code}
                      onPress={() => {
                        setReasonCode(code);
                        setReasonMenu(false);
                      }}
                      title={t(`rentals.unavailableReasons.${code}`, code)}
                    />
                  ))}
                </Menu>
                <TextInput
                  label={t('business.rentals.responseNote', 'Note (optional)')}
                  value={unavailableNote}
                  onChangeText={setUnavailableNote}
                  mode="outlined"
                  multiline
                  style={styles.field}
                />
              </View>
            )}

            {error ? (
              <Text style={{ color: colors.error.main, marginTop: 8 }}>{error}</Text>
            ) : null}
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={resetAndClose} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            mode="contained"
            loading={submitting}
            disabled={submitting || declineBlocked(mode, reasonCode, unavailableNote)}
            onPress={() => {
              if (mode === 'available') void submitAvailable();
              else void submitUnavailable();
            }}
          >
            {mode === 'available'
              ? t('business.rentals.accept', 'Accept')
              : t('business.rentals.submitResponse', 'Send response')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

/** Confirm soft-delete helper used by detail screens. */
function declineBlocked(
  mode: 'available' | 'unavailable' | null,
  reason: UnavailableRentalReasonCode | '',
  note: string
): boolean {
  if (mode !== 'unavailable') return false;
  if (!reason) return true;
  return reason === 'other' && !note.trim();
}

function respondErrorText(
  error: unknown,
  locale: string,
  t: (key: string, fallback: string) => string
): string {
  return (
    cardWindowErrorMessage(error, locale) ??
    (error instanceof Error ? error.message : t('business.rentals.respondFailed', 'Could not send response'))
  );
}

export function confirmSoftDelete(
  title: string,
  message: string,
  onConfirm: () => void,
  t: (k: string, d: string) => string
): void {
  Alert.alert(title, message, [
    { text: t('common.cancel', 'Cancel'), style: 'cancel' },
    { text: t('common.delete', 'Delete'), style: 'destructive', onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  field: { marginTop: 12 },
});
