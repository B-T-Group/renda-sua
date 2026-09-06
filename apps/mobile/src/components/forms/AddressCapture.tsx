import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useAddressFromCurrentLocation } from '../../hooks/useAddressFromCurrentLocation';
import { DeliveryAddressForm, type DeliveryAddressFormValue } from './DeliveryAddressForm';

export type AddressCaptureContext = 'delivery' | 'store' | 'generic';

export interface AddressCaptureProps {
  value: DeliveryAddressFormValue;
  onChange: (next: DeliveryAddressFormValue) => void;
  context?: AddressCaptureContext;
  disabled?: boolean;
  disableCountry?: boolean;
  enableAutocomplete?: boolean;
  postalRequired?: boolean;
}

type CaptureMode = 'chooser' | 'detecting' | 'review' | 'confirmed' | 'manual';

function isValueEmpty(v: DeliveryAddressFormValue): boolean {
  return !v.address_line_1.trim() && !v.country.trim() && !v.city.trim();
}

function formatAddressSummary(v: DeliveryAddressFormValue): string {
  return [v.address_line_1, v.city, v.state, v.country]
    .filter(Boolean)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

function AddressSummaryCard({
  value,
  label,
}: {
  value: DeliveryAddressFormValue;
  label: string;
}) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderColor: colors.divider,
          padding: spacing.md,
        },
      ]}
    >
      <Text variant="labelSmall" style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.text.primary }} numberOfLines={3}>
        {formatAddressSummary(value)}
      </Text>
      {value.postal_code ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
          {value.postal_code}
        </Text>
      ) : null}
    </View>
  );
}

export function AddressCapture({
  value,
  onChange,
  context = 'generic',
  disabled = false,
  disableCountry = false,
  enableAutocomplete = true,
  postalRequired = false,
}: AddressCaptureProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  const [mode, setMode] = useState<CaptureMode>(disableCountry ? 'manual' : 'chooser');
  const [reviewValue, setReviewValue] = useState<DeliveryAddressFormValue | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { detect } = useAddressFromCurrentLocation();

  useEffect(() => {
    if (disableCountry) setMode('manual');
  }, [disableCountry]);

  const handleAutoDetect = useCallback(async () => {
    setLocationError(null);
    setMode('detecting');
    const { value: detected, status } = await detect();
    if (!detected) {
      setLocationError(
        status === 'denied'
          ? t('addresses.locationDenied', 'Location permission is required to fill your address from GPS.')
          : t('addresses.locationFailed', 'Could not read your location. Try again or enter the address manually.')
      );
      setMode('chooser');
      return;
    }
    setReviewValue(detected);
    setMode('review');
  }, [detect, t]);

  const handleNext = useCallback(() => {
    if (reviewValue) {
      onChange(reviewValue);
    }
    setMode('confirmed');
  }, [onChange, reviewValue]);

  const handleEditDetected = useCallback(() => {
    if (reviewValue) {
      onChange(reviewValue);
    }
    setReviewValue(null);
    setMode('manual');
  }, [onChange, reviewValue]);

  const handleEnterManually = useCallback(() => {
    setReviewValue(null);
    setMode('manual');
  }, []);

  const handleEditConfirmed = useCallback(() => {
    setReviewValue(null);
    setMode('manual');
  }, []);

  const handleBackToChooser = useCallback(() => {
    setReviewValue(null);
    setMode(disableCountry ? 'manual' : 'chooser');
  }, [disableCountry]);

  const hasExisting = !isValueEmpty(value);

  const recommendationKey =
    context === 'delivery'
      ? 'addresses.capture.autoDetectRecommendedDelivery'
      : context === 'store'
        ? 'addresses.capture.autoDetectRecommendedStore'
        : 'addresses.capture.autoDetectRecommendedGeneric';

  const recommendationDefault =
    context === 'delivery'
      ? 'Recommended if you are currently at your delivery address.'
      : context === 'store'
        ? 'Recommended if you are currently at your store.'
        : 'Recommended if you are currently at this address.';

  const manualLinkLabel = hasExisting
    ? t('addresses.capture.editManuallyLink', 'Edit manually')
    : t('addresses.capture.enterManuallyLink', 'Enter address manually');

  if (mode === 'chooser') {
    return (
      <View style={styles.root}>
        {hasExisting ? (
          <AddressSummaryCard
            value={value}
            label={t('addresses.capture.currentAddressLabel', 'Current address')}
          />
        ) : null}

        <View
          style={[
            styles.autoDetectCard,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              borderColor: colors.primary.light,
              padding: spacing.md,
              marginTop: hasExisting ? spacing.md : 0,
            },
          ]}
        >
          <Button
            mode="contained"
            icon="crosshairs-gps"
            onPress={() => void handleAutoDetect()}
            disabled={disabled}
            style={styles.fullWidth}
          >
            {t('addresses.capture.autoDetectBtn', 'Use my current location')}
          </Button>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: spacing.xs, textAlign: 'center' }}
          >
            {t(recommendationKey, recommendationDefault)}
          </Text>
        </View>

        {locationError ? (
          <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: spacing.xs }}>
            {locationError}
          </Text>
        ) : null}

        <Button
          mode="text"
          onPress={handleEnterManually}
          disabled={disabled}
          style={{ marginTop: spacing.xs, alignSelf: 'center' }}
        >
          {manualLinkLabel}
        </Button>
      </View>
    );
  }

  if (mode === 'detecting') {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: spacing.md }}>
          {t('addresses.capture.detectingTitle', 'Detecting location…')}
        </Text>
      </View>
    );
  }

  if (mode === 'review' && reviewValue) {
    const fields: Array<{ label: string; value: string }> = [
      { label: t('addresses.addressLine1', 'Address line 1'), value: reviewValue.address_line_1 },
      { label: t('addresses.city', 'City'), value: reviewValue.city },
      { label: t('addresses.state', 'State / region'), value: reviewValue.state },
      { label: t('addresses.country', 'Country'), value: reviewValue.country },
      ...(reviewValue.postal_code
        ? [{ label: t('addresses.postalCode', 'Postal code'), value: reviewValue.postal_code }]
        : []),
    ].filter((f) => f.value.trim());

    return (
      <View style={styles.root}>
        <Text
          variant="titleSmall"
          style={{ color: colors.text.primary, marginBottom: spacing.xs }}
        >
          {t('addresses.capture.reviewTitle', 'Is this your address?')}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginBottom: spacing.md }}
        >
          {t(
            'addresses.capture.reviewSubtitle',
            'We detected this from your GPS. Confirm if it looks right, or edit it.'
          )}
        </Text>

        <View
          style={[
            styles.reviewCard,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              borderColor: colors.divider,
              padding: spacing.md,
            },
          ]}
        >
          {fields.map((f) => (
            <View key={f.label} style={styles.reviewRow}>
              <Text variant="labelSmall" style={{ color: colors.text.secondary, width: 96 }}>
                {f.label}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: colors.text.primary, flex: 1 }}
                numberOfLines={2}
              >
                {f.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.reviewActions, { marginTop: spacing.md }]}>
          <Button
            mode="outlined"
            onPress={handleEditDetected}
            disabled={disabled}
            style={styles.halfBtn}
          >
            {t('addresses.capture.editBtn', 'Edit')}
          </Button>
          <Button
            mode="contained"
            onPress={handleNext}
            disabled={disabled}
            style={styles.halfBtn}
          >
            {t('addresses.capture.confirmYesBtn', 'Yes')}
          </Button>
        </View>
      </View>
    );
  }

  if (mode === 'confirmed') {
    const confirmedValue = reviewValue ?? value;
    return (
      <View style={styles.root}>
        <AddressSummaryCard
          value={confirmedValue}
          label={t('addresses.capture.detectedAddressLabel', 'Detected address')}
        />
        <Button
          mode="outlined"
          onPress={handleEditConfirmed}
          disabled={disabled}
          style={[styles.fullWidth, { marginTop: spacing.md }]}
        >
          {t('addresses.capture.editBtn', 'Edit')}
        </Button>
        {disableCountry ? null : (
        <Button
          mode="text"
          icon="crosshairs-gps"
          onPress={handleBackToChooser}
          disabled={disabled}
          style={{ marginTop: spacing.xs, alignSelf: 'center' }}
        >
          {t('addresses.capture.useCurrentLocationSecondary', 'Use current location instead')}
        </Button>
        )}
      </View>
    );
  }

  // manual mode — opened from chooser ("enter/edit manually") or from Edit after auto-detect
  return (
    <View style={styles.root}>
      <DeliveryAddressForm
        value={value}
        onChange={onChange}
        disabled={disabled}
        disableCountry={disableCountry}
        enableAutocomplete={enableAutocomplete}
        postalRequired={postalRequired}
      />
      {disableCountry ? null : (
      <Button
        mode="text"
        icon="crosshairs-gps"
        onPress={handleBackToChooser}
        disabled={disabled}
        style={{ marginTop: spacing.xs, alignSelf: 'center' }}
      >
        {t('addresses.capture.useCurrentLocationSecondary', 'Use current location instead')}
      </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 0 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  fullWidth: { alignSelf: 'stretch' },
  halfBtn: { flex: 1 },
  autoDetectCard: { borderWidth: 1 },
  summaryCard: { borderWidth: StyleSheet.hairlineWidth },
  reviewCard: { borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  reviewRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reviewActions: { flexDirection: 'row', gap: 8 },
});
