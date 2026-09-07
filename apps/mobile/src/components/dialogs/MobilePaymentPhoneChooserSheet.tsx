import React, { useMemo } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import type { MobileMoneyVerificationMethod, MobilePaymentPhone } from '../../types/mobilePaymentPhone';

export type MobilePaymentPhoneChooserSheetProps = {
  visible: boolean;
  phones: MobilePaymentPhone[];
  selectedPhoneId?: string | null;
  allowNone?: boolean;
  explain?: string;
  verificationMethod?: MobileMoneyVerificationMethod | null;
  onDismiss: () => void;
  onSelect: (phone: MobilePaymentPhone) => void;
  onAddNew: () => void;
  onVerify?: (phone: MobilePaymentPhone) => void;
  /** When true, prioritize unverified numbers and a primary Verify CTA. */
  verifyFirst?: boolean;
  onSelectNone?: () => void;
};

export function MobilePaymentPhoneChooserSheet({
  visible,
  phones,
  selectedPhoneId,
  allowNone = false,
  explain,
  verificationMethod = null,
  onDismiss,
  onSelect,
  onAddNew,
  onVerify,
  verifyFirst = false,
  onSelectNone,
}: MobilePaymentPhoneChooserSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const sorted = useMemo(() => {
    return [...phones].sort((a, b) => {
      if (a.is_verified === b.is_verified) return 0;
      if (verifyFirst) return a.is_verified ? 1 : -1;
      return a.is_verified ? -1 : 1;
    });
  }, [phones, verifyFirst]);

  const firstUnverified = useMemo(
    () => sorted.find((p) => !p.is_verified) ?? null,
    [sorted]
  );
  const primaryIsVerify = Boolean(verifyFirst && firstUnverified && onVerify);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleLarge"
            style={[typography.h6, { color: colors.text.primary, padding: spacing.md }]}
          >
            {t('mobilePaymentPhone.chooseTitle', 'Mobile money number')}
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: colors.text.secondary,
              paddingHorizontal: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
            {explain ??
              (verifyFirst
                ? verificationMethod !== 'transaction'
                  ? t(
                      'mobilePaymentPhone.chooseExplainQuestion',
                      'Confirm the number that receives your Mobile Money payouts, or add a new one.'
                    )
                  : t(
                      'mobilePaymentPhone.chooseExplainVerify',
                      'We need to verify that this phone number can receive Mobile Money payments. Verify an existing number, or add a new one.'
                    )
                : t(
                    'mobilePaymentPhone.chooseExplain',
                    'Choose a verified mobile money number to link, or add a new one.'
                  ))}
          </Text>

          {sorted.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{
                color: colors.text.secondary,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.lg,
                textAlign: 'center',
              }}
            >
              {t(
                'mobilePaymentPhone.chooseEmpty',
                'No numbers yet. Add a mobile money number to get started.'
              )}
            </Text>
          ) : (
            <FlatList
              data={sorted}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: screenHeight * 0.4 }}
              contentContainerStyle={{ paddingHorizontal: spacing.md }}
              renderItem={({ item }) => {
                const selected = item.id === selectedPhoneId;
                const isPrimaryUnverified =
                  primaryIsVerify && item.id === firstUnverified?.id;
                return (
                  <Pressable
                    onPress={() => {
                      if (item.is_verified) {
                        onSelect(item);
                        return;
                      }
                      if (onVerify) onVerify(item);
                    }}
                    style={[
                      styles.row,
                      {
                        borderColor: isPrimaryUnverified
                          ? colors.primary.main
                          : colors.divider,
                        backgroundColor: selected
                          ? `${colors.primary.main}14`
                          : isPrimaryUnverified
                            ? `${colors.primary.main}0A`
                            : 'transparent',
                      },
                    ]}
                  >
                    <View style={styles.rowMain}>
                      <Text
                        variant="bodyLarge"
                        style={{ color: colors.text.primary }}
                        numberOfLines={1}
                      >
                        {item.phone_e164}
                      </Text>
                      <StatusPill
                        compact
                        label={
                          item.is_verified
                            ? t('mobilePaymentPhone.verified', 'Verified')
                            : t('mobilePaymentPhone.unverified', 'Unverified')
                        }
                        backgroundColor={
                          item.is_verified
                            ? `${colors.success.main}24`
                            : `${colors.warning.main}24`
                        }
                        textColor={
                          item.is_verified ? colors.success.dark : colors.warning.dark
                        }
                      />
                    </View>
                    {!item.is_verified &&
                    onVerify &&
                    // Avoid a second Verify when the bottom primary CTA already covers this number.
                    !(primaryIsVerify && isPrimaryUnverified) ? (
                      <Button
                        mode="outlined"
                        compact
                        onPress={() => onVerify(item)}
                      >
                        {t('mobilePaymentPhone.verifyShort', 'Verify')}
                      </Button>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          )}

          <View style={[styles.actions, { padding: spacing.md, gap: spacing.sm }]}>
            {allowNone && onSelectNone ? (
              <Button mode="outlined" onPress={onSelectNone}>
                {t('mobilePaymentPhone.noneForLocation', 'None for this location')}
              </Button>
            ) : null}
            {primaryIsVerify && firstUnverified && onVerify ? (
              <Button
                mode="contained"
                onPress={() => onVerify(firstUnverified)}
                contentStyle={styles.primaryBtn}
              >
                {t('mobilePaymentPhone.verifyThisNumber', 'Verify this number')}
              </Button>
            ) : null}
            <Button
              mode={primaryIsVerify ? 'outlined' : 'contained'}
              onPress={onAddNew}
              contentStyle={styles.primaryBtn}
            >
              {t('mobilePaymentPhone.addNewCta', 'Add a new number')}
            </Button>
            <Button mode="text" onPress={onDismiss}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 8,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  actions: {
    flexDirection: 'column',
  },
  primaryBtn: {
    minHeight: 48,
  },
});
