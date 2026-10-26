import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/apiClient';

type LateStatus = {
  canEnter: boolean;
  locked: boolean;
  expired: boolean;
  maskedReferrerName: string | null;
};

export function LateReferralCodeCard() {
  const { t } = useTranslation();
  const { colors, spacing, shadows, borderRadius } = useTheme();
  const [status, setStatus] = useState<LateStatus | null>(null);
  const [code, setCode] = useState('');
  const [maskedName, setMaskedName] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalized = useMemo(
    () => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
    [code]
  );

  useEffect(() => {
    void api
      .get<{ success: boolean; data: LateStatus }>('/referrals/late/status')
      .then((res) => setStatus(res.data ?? null))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (normalized.length !== 6 || !status?.canEnter) {
      setMaskedName('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setLookingUp(true);
          setError(null);
          const res = await api.get<{
            success: boolean;
            data: { maskedName: string };
          }>(`/referrals/late/lookup/${encodeURIComponent(normalized)}`);
          if (!cancelled) setMaskedName(res.data?.maskedName ?? '');
        } catch (err: unknown) {
          if (!cancelled) {
            setMaskedName('');
            setError(
              err instanceof Error
                ? err.message
                : t('referrals.late.not_found', 'No user found with this code.')
            );
          }
        } finally {
          if (!cancelled) setLookingUp(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized, status?.canEnter, t]);

  if (!status || status.expired) return null;

  if (status.locked) {
    return (
      <View
        style={[
          shadows.sm,
          {
            backgroundColor: colors.background.paper,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.divider,
          },
        ]}
      >
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t('referrals.late.locked', 'Referred by {{name}} · locked', {
            name: status.maskedReferrerName || '—',
          })}
        </Text>
      </View>
    );
  }

  if (!status.canEnter) return null;

  const onConfirm = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await api.post<{
        success: boolean;
        data: { maskedName: string };
      }>('/referrals/late', { code: normalized });
      setSuccess(t('referrals.late.success', 'Referral code saved.'));
      setStatus({
        canEnter: false,
        locked: true,
        expired: false,
        maskedReferrerName: res.data?.maskedName ?? maskedName,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('referrals.late.error', 'Could not save referral code.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      style={[
        shadows.sm,
        {
          backgroundColor: colors.background.paper,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.divider,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '600' }}>
        {t('referrals.late.menu', 'Referral code')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'referrals.late.hint',
          'Enter the code of the person who invited you.'
        )}
      </Text>
      {error ? <Text style={{ color: colors.error.main }}>{error}</Text> : null}
      {success ? (
        <Text style={{ color: colors.success.main }}>{success}</Text>
      ) : (
        <>
          <TextInput
            mode="outlined"
            label={t('referrals.late.title', 'Who referred you?')}
            value={normalized}
            onChangeText={setCode}
            maxLength={6}
            autoCapitalize="characters"
            right={
              lookingUp ? (
                <TextInput.Icon icon={() => <ActivityIndicator />} />
              ) : undefined
            }
          />
          {maskedName ? (
            <Text style={{ color: colors.primary.main }}>
              {t('referrals.late.found', 'Referred by {{name}}', {
                name: maskedName,
              })}
            </Text>
          ) : null}
          <Button
            mode="contained"
            disabled={!maskedName || lookingUp || saving}
            loading={saving}
            onPress={() => void onConfirm()}
          >
            {t('referrals.late.confirm', 'Confirm')}
          </Button>
          <Text variant="labelSmall" style={{ color: colors.warning.dark }}>
            {t(
              'referrals.late.confirm_body',
              "{{name}} will be saved as your referrer. This can't be changed later.",
              { name: maskedName || '…' }
            )}
          </Text>
        </>
      )}
    </View>
  );
}
