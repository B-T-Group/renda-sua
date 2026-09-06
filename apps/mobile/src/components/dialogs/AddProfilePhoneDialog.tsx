import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { CountryCode } from 'libphonenumber-js';
import { agentApi } from '../../services/agentApi';
import { useTheme } from '../../contexts/ThemeContext';
import PhoneNumberInput from '../PhoneNumberInput';
import { pickDefaultPhoneCountry } from '../../utils/deviceDefaultCountry';
import { nationalDigitsToE164 } from '../../utils/phoneLoginUsername';

export interface AddProfilePhoneDialogProps {
  visible: boolean;
  defaultCountry?: string | null;
  onDismiss: () => void;
  onSaved: () => void;
}

export function AddProfilePhoneDialog({
  visible,
  defaultCountry,
  onDismiss,
  onSaved,
}: AddProfilePhoneDialogProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [countryIso, setCountryIso] = useState<CountryCode>(() =>
    pickDefaultPhoneCountry(defaultCountry)
  );
  const [nationalDigits, setNationalDigits] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCountryIso(pickDefaultPhoneCountry(defaultCountry));
    setNationalDigits('');
    setError(null);
  }, [visible, defaultCountry]);

  const e164 = nationalDigitsToE164(countryIso, nationalDigits);

  const onSave = useCallback(async () => {
    if (!e164) {
      setError(t('nudge.contact.phoneInvalid', 'Please enter a valid phone number.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await agentApi.users.setMyPhone({ phoneNumber: e164 });
      if (!res.success) {
        setError(mapPhoneSaveError(res.error || res.message || '', t));
        return;
      }
      onSaved();
      onDismiss();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(mapPhoneSaveError(msg, t));
    } finally {
      setSaving(false);
    }
  }, [e164, onDismiss, onSaved, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={saving ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={saving ? undefined : onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
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
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="phone-outline" size={28} color={colors.primary.main} />
            <Text variant="titleLarge" style={{ flex: 1, marginLeft: 12, color: colors.text.primary }}>
              {t('nudge.contact.phoneDialogTitle', 'Add your phone number')}
            </Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
          >
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 12 }}>
              {t(
                'nudge.contact.phoneDialogBody',
                'We can reach you directly for delivery updates and confirmations.'
              )}
            </Text>
            <PhoneNumberInput
              countryIso={countryIso}
              nationalDigits={nationalDigits}
              onCountryIsoChange={setCountryIso}
              onNationalDigitsChange={(digits) => {
                setNationalDigits(digits);
                setError(null);
              }}
              hasError={nationalDigits.length > 0 && !e164}
              disabled={saving}
            />
            {error ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: 10 }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View style={[styles.actions, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
            <Button onPress={onDismiss} disabled={saving} mode="text">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button mode="contained" onPress={() => void onSave()} loading={saving} disabled={saving || !e164}>
              {t('common.save', 'Save')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function mapPhoneSaveError(
  msg: string,
  t: (key: string, defaultValue: string) => string
): string {
  if (msg.toLowerCase().includes('taken') || msg.includes('409')) {
    return t('nudge.contact.phoneTaken', 'This phone number is already in use.');
  }
  return msg || t('nudge.contact.phoneError', 'Could not save your phone number.');
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: { overflow: 'hidden' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
  },
});
