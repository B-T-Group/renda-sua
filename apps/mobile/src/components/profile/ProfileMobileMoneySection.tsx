import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobilePaymentPhones } from '../../hooks/useMobilePaymentPhones';
import { MobilePaymentPhoneChooserSheet } from '../dialogs/MobilePaymentPhoneChooserSheet';
import { MobilePaymentPhoneVerifyModal } from '../dialogs/MobilePaymentPhoneVerifyModal';
import type { MobilePaymentPhone, MobilePaymentPhoneModalMode } from '../../types/mobilePaymentPhone';

function isMoMoMarket(country?: string | null): boolean {
  const c = (country ?? '').trim().toUpperCase();
  return c === 'CM' || c === 'GA';
}

type Props = {
  profilePhone?: string | null;
  profileCountry?: string | null;
};

export function ProfileMobileMoneySection({ profilePhone, profileCountry }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const { phones, loading, fetchPhones, verificationMethod, api } = useMobilePaymentPhones(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyMode, setVerifyMode] = useState<MobilePaymentPhoneModalMode>('add');
  const [verifyInitial, setVerifyInitial] = useState<MobilePaymentPhone | null>(null);

  const defaultPhone = useMemo(
    () => phones.find((p) => p.is_default) ?? phones[0] ?? null,
    [phones]
  );

  const showSection =
    phones.length > 0 || isMoMoMarket(profileCountry) || Boolean(profilePhone?.trim());

  const selectDefault = useCallback(
    async (phone: MobilePaymentPhone) => {
      await api.setDefault(phone.id);
      await fetchPhones();
      setChooserOpen(false);
    },
    [api, fetchPhones]
  );

  const linkProfile = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.linkProfile();
      if (!res.data?.phone) {
        setError(
          t(
            'mobilePaymentPhone.profileNotMobileMoney',
            'Your profile phone is not a Mobile Money number'
          )
        );
        return;
      }
      await selectDefault(res.data.phone);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }, [api, selectDefault, t]);

  const openAdd = () => {
    setVerifyMode('add');
    setVerifyInitial(null);
    setVerifyOpen(true);
  };

  if (!showSection) return null;

  return (
    <>
      <View
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.divider,
          ...shadows.sm,
        }}
      >
        <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: 4 }}>
          {t('mobilePaymentPhone.profileTitle', 'Mobile Money number')}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
          {t('mobilePaymentPhone.profileHelper', 'Payment requests go to this number.')}
        </Text>
        {error ? (
          <Text variant="bodySmall" style={{ color: colors.error.main, marginBottom: spacing.sm }}>
            {error}
          </Text>
        ) : null}
        {loading && !defaultPhone ? (
          <ActivityIndicator color={colors.primary.main} />
        ) : defaultPhone ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="bodyLarge">{defaultPhone.phone_e164}</Text>
            <StatusPill
              compact
              label={
                defaultPhone.is_verified
                  ? t('mobilePaymentPhone.verified', 'Verified')
                  : t('mobilePaymentPhone.unverified', 'Not verified')
              }
              backgroundColor={
                defaultPhone.is_verified
                  ? `${colors.success.main}24`
                  : `${colors.warning.main}24`
              }
              textColor={
                defaultPhone.is_verified ? colors.success.dark : colors.warning.dark
              }
            />
            <Button mode="outlined" compact onPress={() => { void fetchPhones(); setChooserOpen(true); }}>
              {t('common.change', 'Change')}
            </Button>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
              {t('mobilePaymentPhone.noneYet', 'No Mobile Money number linked yet.')}
            </Text>
            {profilePhone?.trim() ? (
              <Button mode="contained" loading={busy} disabled={busy} onPress={() => void linkProfile()}>
                {t('mobilePaymentPhone.useProfilePhone', 'Use {{phone}} for Mobile Money', {
                  phone: profilePhone,
                })}
              </Button>
            ) : null}
            <Button mode={profilePhone?.trim() ? 'outlined' : 'contained'} onPress={openAdd}>
              {t('mobilePaymentPhone.linkNumber', 'Link a Mobile Money number')}
            </Button>
          </View>
        )}
      </View>

      <MobilePaymentPhoneChooserSheet
        visible={chooserOpen}
        phones={phones}
        selectedPhoneId={defaultPhone?.id}
        verificationMethod={verificationMethod}
        onDismiss={() => setChooserOpen(false)}
        onSelect={(phone) => void selectDefault(phone)}
        onAddNew={() => {
          setChooserOpen(false);
          openAdd();
        }}
        onVerify={(phone) => {
          setChooserOpen(false);
          setVerifyMode('verify');
          setVerifyInitial(phone);
          setVerifyOpen(true);
        }}
      />
      <MobilePaymentPhoneVerifyModal
        visible={verifyOpen}
        mode={verifyMode}
        initialPhone={verifyInitial}
        setAsDefault
        allowSkipVerification
        onDismiss={() => {
          setVerifyOpen(false);
          setVerifyInitial(null);
        }}
        onCompleted={(phone) => {
          void selectDefault(phone);
          setVerifyOpen(false);
          setVerifyInitial(null);
        }}
      />
    </>
  );
}
