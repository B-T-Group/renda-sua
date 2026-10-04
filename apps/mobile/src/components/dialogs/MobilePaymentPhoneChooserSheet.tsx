import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet } from '../common/BottomSheet';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
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
  const { colors, spacing } = useTheme();

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
    <BottomSheet
      visible={visible}
      onClose={onDismiss}
      snapPoints={['70%']}
      unwrapped
      footer={
        <View style={[styles.actions, { gap: spacing.sm }]}>
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
      }
    >
      <BottomSheetScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}
      >
          <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: spacing.sm }}>
            {t('mobilePaymentPhone.chooseTitle', 'Mobile money number')}
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: colors.text.secondary,
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
            <>
            {sorted.map((item) => {
                const selected = item.id === selectedPhoneId;
                const isPrimaryUnverified =
                  primaryIsVerify && item.id === firstUnverified?.id;
                return (
                  <Pressable
                    key={item.id}
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
            })}
            </>
          )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
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
