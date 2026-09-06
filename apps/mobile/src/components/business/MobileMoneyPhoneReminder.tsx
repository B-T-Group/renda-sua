import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme';
import { MobileMoneyConfirmIllustration } from '../illustrations/MobileMoneyConfirmIllustration';
import type { MmPhoneReminderVariant } from '../../utils/mmPhoneReminder';

type PhoneCtaVariant = 'none' | 'link' | 'confirm';

type Props = {
  variant: MmPhoneReminderVariant;
  ctaVariant: PhoneCtaVariant;
  onConfirm: () => void;
  onDismiss?: () => void;
};

function reminderMessage(t: (k: string, d: string) => string, cta: PhoneCtaVariant): string {
  if (cta === 'link') {
    return t(
      'mobilePaymentPhone.reminderLinkBody',
      'Link a confirmed mobile money number to your locations so you can receive payments.'
    );
  }
  if (cta === 'confirm') {
    return t(
      'mobilePaymentPhone.reminderConfirmBody',
      'Confirm that your phone number can receive Mobile Money payments.'
    );
  }
  return t(
    'mobilePaymentPhone.reminderAddBody',
    'Add and confirm a mobile money number so customers can pay you.'
  );
}

function blockingMessage(t: (k: string, d: string) => string): string {
  return t(
    'mobilePaymentPhone.blockingBody',
    'You cannot receive orders until you confirm a mobile payments phone number on your locations.'
  );
}

function actionLabel(t: (k: string, d: string) => string, cta: PhoneCtaVariant): string {
  if (cta === 'none') {
    return t('mobilePaymentPhone.addNewCta', 'Add a new number');
  }
  if (cta === 'link') {
    return t(
      'mobilePaymentPhone.linkOrAddCta',
      'Link or add mobile money number'
    );
  }
  return t('mobilePaymentPhone.confirmCta', 'Confirm mobile money number');
}

export function MobileMoneyPhoneReminder({
  variant,
  ctaVariant,
  onConfirm,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const blocking = variant === 'blocking';
  const accent = blocking ? colors.warning.main : colors.info.main;
  const tint = blocking ? colors.warningTint : colors.infoTint;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: accent,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      {!blocking && onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss', 'Dismiss')}
          style={styles.dismiss}
        >
          <MaterialCommunityIcons
            name="close"
            size={22}
            color={colors.text.secondary}
          />
        </Pressable>
      ) : null}

      <View style={styles.hero}>
        <MobileMoneyConfirmIllustration />
      </View>

      <Text
        variant="titleMedium"
        style={{
          color: colors.text.primary,
          fontWeight: '700',
          marginTop: spacing.xs,
          paddingRight: blocking ? 0 : 28,
        }}
      >
        {blocking
          ? t(
              'mobilePaymentPhone.blockingTitle',
              'Confirm a mobile payments number'
            )
          : t(
              'mobilePaymentPhone.reminderTitle',
              'Confirm your mobile money number'
            )}
      </Text>

      <Text
        variant="bodyMedium"
        style={{
          color: colors.text.secondary,
          marginTop: 6,
          lineHeight: 21,
          backgroundColor: tint,
          borderRadius: borderRadius.md,
          padding: spacing.sm,
          overflow: 'hidden',
        }}
      >
        {blocking ? blockingMessage(t) : reminderMessage(t, ctaVariant)}
      </Text>

      <Button
        mode="contained"
        onPress={onConfirm}
        style={{ marginTop: spacing.md }}
        buttonColor={blocking ? colors.warning.dark : undefined}
        contentStyle={styles.cta}
      >
        {actionLabel(t, ctaVariant)}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    position: 'relative',
  },
  dismiss: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
  },
  cta: {
    minHeight: 48,
  },
});
