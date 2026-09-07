import { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { AppModal } from '../common/AppModal';
import { AddressCapture } from '../forms/AddressCapture';
import { type DeliveryAddressFormValue } from '../forms/DeliveryAddressForm';
import { CompleteAddressIllustration } from '../illustrations/CompleteAddressIllustration';
import { useTheme } from '../../contexts/ThemeContext';
import { isAddressComplete } from '../../utils/addressCompleteness';

export type CompleteAddressReason = 'enroll' | 'checkout';

export interface CompleteAddressPromptProps {
  visible: boolean;
  reason: CompleteAddressReason;
  value: DeliveryAddressFormValue;
  onChange: (next: DeliveryAddressFormValue) => void;
  onSave: () => void;
  saving?: boolean;
  error?: string | null;
  /** Enroll: no dismiss. Checkout: allow closing without saving. */
  allowDismiss?: boolean;
  onDismiss?: () => void;
}

export function CompleteAddressPrompt({
  visible,
  reason,
  value,
  onChange,
  onSave,
  saving = false,
  error = null,
  allowDismiss = false,
  onDismiss,
}: CompleteAddressPromptProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const complete = isAddressComplete(value);

  const title =
    reason === 'enroll'
      ? t('addresses.completePrompt.enrollTitle', 'Complete your address')
      : t('addresses.completePrompt.checkoutTitle', 'Complete delivery address');
  const body =
    reason === 'enroll'
      ? t(
          'addresses.completePrompt.enrollBody',
          'Your current address is missing city, region, or postal code. Complete it so we can set up your new role correctly.'
        )
      : t(
          'addresses.completePrompt.checkoutBody',
          'Card checkout needs a full delivery address including city, region, and postal code.'
        );

  return (
    <AppModal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (allowDismiss && !saving) onDismiss?.();
      }}
    >
      <KeyboardAvoidingView
        style={[styles.root, { width, height, backgroundColor: colors.pageBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + spacing.md,
              paddingHorizontal: spacing.md,
              borderBottomColor: colors.divider,
            },
          ]}
        >
          <CompleteAddressIllustration size={112} />
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]} numberOfLines={2}>
            {title}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }} numberOfLines={4}>
            {body}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.divider,
                borderRadius: borderRadius.md,
                padding: spacing.md,
              },
            ]}
          >
          <AddressCapture
            value={value}
            onChange={onChange}
            disabled={saving}
            postalRequired
            context="delivery"
          />
          </View>
          {error ? (
            <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: spacing.sm }} numberOfLines={3}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md),
              paddingHorizontal: spacing.md,
              paddingTop: spacing.sm,
              borderTopColor: colors.divider,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Button
            mode="contained"
            onPress={onSave}
            loading={saving}
            disabled={saving || !complete}
            style={styles.primaryBtn}
          >
            {t('addresses.completePrompt.saveContinue', 'Save and continue')}
          </Button>
          {allowDismiss ? (
            <Button mode="text" onPress={onDismiss} disabled={saving} style={{ marginTop: 4 }}>
              {t('common.cancel', 'Cancel')}
            </Button>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontWeight: '700', textAlign: 'center', marginTop: 4 },
  scroll: { flex: 1 },
  formCard: { borderWidth: StyleSheet.hairlineWidth },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  primaryBtn: { alignSelf: 'stretch' },
});
