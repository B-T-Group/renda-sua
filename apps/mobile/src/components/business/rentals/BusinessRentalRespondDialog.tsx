import React, { useCallback, useMemo, useState } from 'react';
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
import {
  computeRentalPricingLines,
  formatRentalMoney,
  parseRentalSelectionWindowsFromJson,
} from '../../../utils/rentals';
import { useTheme } from '../../../contexts/ThemeContext';
import { rentalsApi } from '../../../services/rentalsApi';

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
}

function buildPricingSnapshot(req: BusinessRentalRequestRow) {
  const windows = parseRentalSelectionWindowsFromJson(req.rental_selection_windows);
  const ratePerHour = Number(req.rental_location_listing.base_price_per_hour);
  const ratePerDay = Number(req.rental_location_listing.base_price_per_day ?? 0);
  const { lines, total } = computeRentalPricingLines(windows, ratePerHour, ratePerDay);
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
}: BusinessRentalRespondDialogProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [contractHours, setContractHours] = useState('48');
  const [availableNote, setAvailableNote] = useState('');
  const [reasonCode, setReasonCode] = useState<UnavailableRentalReasonCode | ''>('');
  const [unavailableNote, setUnavailableNote] = useState('');
  const [reasonMenu, setReasonMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const offerPreview = useMemo(() => {
    if (!request || mode !== 'available') return null;
    try {
      return buildPricingSnapshot(request);
    } catch {
      return null;
    }
  }, [mode, request]);

  const resetAndClose = useCallback(() => {
    setContractHours('48');
    setAvailableNote('');
    setReasonCode('');
    setUnavailableNote('');
    setError(null);
    onDismiss();
  }, [onDismiss]);

  const submitAvailable = useCallback(async () => {
    if (!request) return;
    const h = parseInt(contractHours, 10);
    if (!Number.isInteger(h) || h < 1 || h > 168) {
      setError(
        t(
          'business.rentals.respondValidationHours',
          'Enter a whole number of hours between 1 and 168.'
        )
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const snap = buildPricingSnapshot(request);
      await rentalsApi.respondToRequest(request.id, {
        status: 'available',
        rentalPricingSnapshot: snap,
        contractExpiryHours: h,
        businessResponseNote: availableNote.trim() || undefined,
      });
      onSuccess();
      resetAndClose();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : t('business.rentals.respondFailed', 'Could not send response')
      );
    } finally {
      setSubmitting(false);
    }
  }, [availableNote, contractHours, onSuccess, request, resetAndClose, t]);

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
      });
      onSuccess();
      resetAndClose();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : t('business.rentals.respondFailed', 'Could not send response')
      );
    } finally {
      setSubmitting(false);
    }
  }, [onSuccess, reasonCode, request, resetAndClose, t, unavailableNote]);

  if (!mode) return null;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={resetAndClose}>
        <Dialog.Title>
          {mode === 'available'
            ? t('business.rentals.accept', 'Accept')
            : t('business.rentals.reject', 'Reject')}
        </Dialog.Title>
        <Dialog.Content>
          <ScrollView style={{ maxHeight: 360 }}>
            {request ? (
              <Text variant="bodyMedium" style={{ marginBottom: 12, color: colors.text.secondary }}>
                {request.rental_location_listing.rental_item.name}
              </Text>
            ) : null}

            {mode === 'available' ? (
              <View>
                {offerPreview ? (
                  <Text style={{ marginBottom: 8, color: colors.text.primary }}>
                    {t('business.rentals.offerTotal', 'Quoted total')}:{' '}
                    {formatRentalMoney(
                      offerPreview.total,
                      offerPreview.currency
                    )}
                  </Text>
                ) : null}
                <TextInput
                  label={t(
                    'business.rentals.contractHours',
                    'Contract valid for (hours)'
                  )}
                  value={contractHours}
                  onChangeText={setContractHours}
                  keyboardType="number-pad"
                  mode="outlined"
                  style={styles.field}
                />
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
            loading={submitting}
            onPress={() => {
              if (mode === 'available') void submitAvailable();
              else void submitUnavailable();
            }}
          >
            {t('common.confirm', 'Confirm')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

/** Confirm soft-delete helper used by detail screens. */
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
