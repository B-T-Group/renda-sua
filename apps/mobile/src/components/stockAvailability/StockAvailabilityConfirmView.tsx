import React from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { StockAvailabilityCheckData } from '../../services/inventoryItemsApi';
import type { StockAvailabilityUiState } from '../../stores/StockAvailabilityStore';
import { StockAvailabilityIllustration } from '../illustrations/StockAvailabilityIllustration';

export interface StockAvailabilityConfirmViewProps {
  uiState: StockAvailabilityUiState;
  data: StockAvailabilityCheckData | null;
  qty: number;
  error: string | null;
  onChangeQty: (qty: number) => void;
  onConfirm: () => void;
  onMarkUnavailable: () => void;
  onClose: () => void;
}

export function StockAvailabilityConfirmView({
  uiState,
  data,
  qty,
  error,
  onChangeQty,
  onConfirm,
  onMarkUnavailable,
  onClose,
}: StockAvailabilityConfirmViewProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const busy = uiState === 'submitting';
  const done = uiState === 'done';

  if (uiState === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (uiState === 'error' || !data) {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: colors.pageBackground,
            padding: spacing.lg,
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <Text variant="bodyMedium" style={{ color: colors.error.main, textAlign: 'center' }}>
          {error ?? t('business.availability.notFound', 'This availability check was not found.')}
        </Text>
        <Button mode="text" onPress={onClose} style={{ marginTop: spacing.md }}>
          {t('common.close', 'Close')}
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          minHeight: windowHeight * 0.85,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <StockAvailabilityIllustration />
        <Text
          variant="headlineSmall"
          style={{ color: colors.text.primary, marginTop: spacing.md, fontWeight: '700' }}
        >
          {done
            ? t('business.availability.doneTitle', 'Reply sent')
            : t('business.availability.title', 'Is this still available?')}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
          {done
            ? t(
                'business.availability.doneSubtitle',
                'The shopper has been notified of your answer.'
              )
            : t(
                'business.availability.subtitle',
                '{{name}} is checking if this is still in stock before ordering.',
                { name: data.clientName }
              )}
        </Text>

        <View
          style={[
            styles.heroCard,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              borderColor: colors.divider,
              marginTop: spacing.lg,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.heroRow}>
            {data.itemImageUrl ? (
              <Image
                source={{ uri: data.itemImageUrl }}
                style={[styles.thumb, { borderRadius: borderRadius.md, backgroundColor: colors.disabled }]}
                resizeMode="cover"
                accessibilityLabel={data.itemName}
              />
            ) : (
              <View
                style={[
                  styles.thumb,
                  {
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.disabled,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text variant="titleLarge" style={{ color: colors.text.secondary }}>
                  ?
                </Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="titleMedium" style={{ color: colors.text.primary }} numberOfLines={2}>
                {data.itemName}
              </Text>
              {data.locationName ? (
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
                  {data.locationName}
                </Text>
              ) : null}
              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
                {t('business.availability.qtyAtRequest', 'Shopper saw {{count}} left', {
                  count: data.quantityAtRequest,
                })}
              </Text>
            </View>
          </View>
        </View>

        {!done ? (
          <>
            <Text
              variant="labelLarge"
              style={{
                color: colors.text.primary,
                marginTop: spacing.lg,
                marginBottom: spacing.sm,
              }}
            >
              {t('business.availability.adjustStock', 'Update stock')}
            </Text>
            <View
              style={[
                styles.stepper,
                {
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  borderColor: colors.divider,
                },
              ]}
            >
              <IconButton
                icon="minus"
                disabled={busy || qty <= 0}
                onPress={() => onChangeQty(Math.max(0, qty - 1))}
                accessibilityLabel={t('business.availability.decrease', 'Decrease stock')}
              />
              <View style={styles.qtyWrap}>
                <Text
                  variant="headlineMedium"
                  style={{ color: colors.text.primary, fontWeight: '700' }}
                >
                  {qty}
                </Text>
                <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
                  {t('business.availability.inStock', 'in stock')}
                </Text>
              </View>
              <IconButton
                icon="plus"
                disabled={busy}
                onPress={() => onChangeQty(qty + 1)}
                accessibilityLabel={t('business.availability.increase', 'Increase stock')}
              />
            </View>

            {error ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: spacing.sm }}>
                {error}
              </Text>
            ) : null}

            <Button
              mode="contained"
              loading={busy}
              disabled={busy}
              onPress={onConfirm}
              style={{ marginTop: spacing.lg }}
              icon="check"
            >
              {qty !== data.currentQuantity
                ? t('business.availability.confirmAdjusted', 'Save stock & confirm available')
                : t('business.availability.confirm', 'Confirm available')}
            </Button>
            <Button
              mode="text"
              disabled={busy}
              textColor={colors.error.main}
              onPress={onMarkUnavailable}
              style={{ marginTop: spacing.sm }}
            >
              {t('business.availability.markUnavailable', 'Mark unavailable')}
            </Button>
          </>
        ) : (
          <Button mode="contained" onPress={onClose} style={{ marginTop: spacing.lg }}>
            {t('common.done', 'Done')}
          </Button>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { borderWidth: StyleSheet.hairlineWidth },
  heroRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 88, height: 88 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
  },
  qtyWrap: { alignItems: 'center', minWidth: 72 },
});
