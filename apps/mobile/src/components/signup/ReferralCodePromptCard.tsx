import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { AgentReferralCodeIllustration } from '@/components/illustrations/AgentReferralCodeIllustration';

type Props = {
  appliedCode?: string;
  disabled?: boolean;
  onPress: () => void;
};

export function ReferralCodePromptCard({
  appliedCode,
  disabled = false,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  if (appliedCode) {
    return (
      <View
        style={[
          styles.prompt,
          shadows.sm,
          {
            backgroundColor: colors.successTint,
            borderColor: colors.success.main,
            borderRadius: borderRadius.md,
            padding: spacing.sm,
            gap: spacing.sm,
          },
        ]}
      >
        <Icon source="check-circle" size={22} color={colors.success.main} />
        <Text
          variant="titleSmall"
          style={[styles.promptTitle, { color: colors.text.primary }]}
        >
          {t('referrals.codeApplied', 'Agent referral code: {{code}}', {
            code: appliedCode,
          })}
        </Text>
        <Button mode="text" compact onPress={onPress} disabled={disabled}>
          {t('referrals.changeCode', 'Change')}
        </Button>
      </View>
    );
  }

  const title = t(
    'referrals.haveCodeLink',
    'Enter the code of the agent who referred you'
  );
  const hint = t(
    'referrals.haveCodeHint',
    'Optional — 6 characters from the Rendasua agent who invited you'
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.prompt,
        shadows.sm,
        {
          backgroundColor: colors.primaryTint,
          borderColor: colors.primary.main,
          borderRadius: borderRadius.md,
          padding: spacing.sm,
          gap: spacing.sm,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <AgentReferralCodeIllustration size={48} />
      <View style={styles.promptText}>
        <Text
          variant="titleSmall"
          style={{ color: colors.text.primary, fontWeight: '700' }}
        >
          {title}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: spacing.xxs }}
        >
          {hint}
        </Text>
      </View>
      <Icon source="chevron-right" size={22} color={colors.primary.main} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  prompt: {
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  promptText: {
    flex: 1,
    minWidth: 0,
  },
  promptTitle: {
    flex: 1,
    minWidth: 0,
    fontWeight: '700',
  },
});
