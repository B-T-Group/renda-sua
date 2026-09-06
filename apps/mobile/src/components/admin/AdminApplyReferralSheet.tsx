import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAgentReferralLookup } from '../../hooks/useAgentReferralLookup';

export interface AdminApplyReferralSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (
    code: string,
    referrer?: { name: string; kind: 'agent' | 'business' }
  ) => Promise<void>;
}

export function AdminApplyReferralSheet({
  visible,
  onDismiss,
  onSubmit,
}: AdminApplyReferralSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lookup = useAgentReferralLookup(code);

  const handleDismiss = () => {
    if (submitting) return;
    setCode('');
    setError(null);
    onDismiss();
  };

  const handleConfirm = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) return;
    setSubmitting(true);
    setError(null);
    try {
      const referrer = lookup.result
        ? {
            name: lookup.result.fullName,
            kind:
              lookup.result.kind === 'business'
                ? ('business' as const)
                : ('agent' as const),
          }
        : undefined;
      await onSubmit(trimmed, referrer);
      setCode('');
      onDismiss();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('admin.referrals.applyError', 'Could not apply this referral code');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel', 'Cancel')}
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
          <Text variant="titleLarge" style={{ marginBottom: spacing.sm }}>
            {t('admin.referrals.applyTitle', 'Apply referral code')}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.text.secondary, marginBottom: spacing.md },
            ]}
          >
            {t(
              'admin.referrals.applyHelp',
              'Enter the 6-character code they forgot at signup.'
            )}
          </Text>
          <TextInput
            mode="outlined"
            autoCapitalize="characters"
            maxLength={6}
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase())}
            label={t('admin.referrals.code', 'Referral code')}
          />
          {lookup.loading ? (
            <View style={styles.lookupRow}>
              <ActivityIndicator size="small" />
            </View>
          ) : lookup.result ? (
            <Text style={[typography.body2, { color: colors.success.main, marginTop: 8 }]}>
              {t('admin.referrals.referredBy', 'Referred by {{name}}', {
                name: lookup.result.fullName,
              })}
            </Text>
          ) : lookup.error ? (
            <Text style={[typography.caption, { color: colors.error.main, marginTop: 8 }]}>
              {lookup.error}
            </Text>
          ) : null}
          {error ? (
            <Text style={[typography.caption, { color: colors.error.main, marginTop: 8 }]}>
              {error}
            </Text>
          ) : null}
          <View style={[styles.actions, { marginTop: spacing.md }]}>
            <Button mode="text" onPress={handleDismiss} disabled={submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={() => void handleConfirm()}
              disabled={submitting || code.trim().length !== 6}
              contentStyle={styles.confirmContent}
            >
              {t('admin.referrals.applyConfirm', 'Apply')}
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
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 20,
  },
  lookupRow: { marginTop: 8 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  confirmContent: { minHeight: 44 },
});
