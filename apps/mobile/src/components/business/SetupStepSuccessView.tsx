import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AgreementSignedIllustration } from '../illustrations/AgreementSignedIllustration';
import { ProductLiveSuccessVector } from '../feedback/ProductLiveSuccessVector';
import { useTheme } from '../../contexts/ThemeContext';

export type SetupSuccessStep =
  | 'agreement'
  | 'identity'
  | 'mobileMoney'
  | 'payouts'
  | 'catalog';

type Props = {
  step: SetupSuccessStep;
  /** `complete` is the final setup celebration; otherwise intermediate step. */
  variant: 'continue' | 'complete';
  isRental?: boolean;
  onContinueSetup?: () => void;
  onBackToDashboard: () => void;
};

export function SetupStepSuccessView({
  step,
  variant,
  isRental = false,
  onContinueSetup,
  onBackToDashboard,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const copy = useMemo(() => {
    if (variant === 'complete') {
      return {
        title: t('business.setup.success.completeTitle', 'You’re set up!'),
        body: isRental
          ? t(
              'business.setup.success.completeBodyRental',
              'Your first rental is in. Keep building your catalog — customers can discover your store as verification finishes.'
            )
          : t(
              'business.setup.success.completeBody',
              'Your first product is in. Keep building your catalog — customers can discover your store as verification finishes.'
            ),
      };
    }
    switch (step) {
      case 'agreement':
        return {
          title: t(
            'business.setup.success.agreementTitle',
            'Agreement signed'
          ),
          body: t(
            'business.setup.success.agreementBody',
            'Your store is active. Return to the dashboard to keep selling — you can earn a Verified badge later.'
          ),
        };
      case 'identity':
        return {
          title: t(
            'business.setup.success.identityTitle',
            'Setup complete — ID under review'
          ),
          body: t(
            'business.setup.success.identityBody',
            'You’re all set for now. Your dashboard is ready while we review your identification. Your account activates once your ID is approved.'
          ),
        };
      case 'mobileMoney':
        return {
          title: t(
            'business.setup.success.mobileMoneyTitle',
            'Mobile money confirmed'
          ),
          body: t(
            'business.setup.success.mobileMoneyBody',
            'Your payout number is ready. Return to the dashboard.'
          ),
        };
      case 'payouts':
        return {
          title: t('business.setup.success.payoutsTitle', 'Payouts connected'),
          body: t(
            'business.setup.success.payoutsBody',
            'Stripe is linked. Return to the dashboard to add your first product.'
          ),
        };
      case 'catalog':
      default:
        return {
          title: t('business.setup.success.catalogTitle', 'Product added'),
          body: t(
            'business.setup.success.catalogBody',
            'Nice work. Return to the dashboard to see what’s next.'
          ),
        };
    }
  }, [variant, step, isRental, t]);

  const iconName =
    step === 'identity'
      ? ('card-account-details-outline' as const)
      : step === 'mobileMoney'
        ? ('cellphone-check' as const)
        : step === 'payouts'
          ? ('credit-card-check-outline' as const)
          : step === 'catalog'
            ? ('package-variant-closed' as const)
            : ('file-sign' as const);

  const primaryAction =
    (step === 'identity' || step === 'agreement') && !onContinueSetup
      ? onBackToDashboard
      : (onContinueSetup ?? onBackToDashboard);
  const primaryLabel =
    (step === 'identity' || step === 'agreement') && !onContinueSetup
      ? t('business.setup.success.goToDashboard', 'Go to dashboard')
      : onContinueSetup
        ? t('business.setup.success.continueSetup', 'Continue setup')
        : t('business.setup.success.backToDashboard', 'Back to dashboard');

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.pageBackground,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
          paddingHorizontal: spacing.lg,
        },
      ]}
    >
      <View style={styles.hero} accessibilityRole="image">
        {variant === 'complete' ? (
          <ProductLiveSuccessVector playToken={1} />
        ) : step === 'agreement' ? (
          <AgreementSignedIllustration />
        ) : (
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.primary.main + '18' },
            ]}
          >
            <MaterialCommunityIcons
              name={iconName}
              size={40}
              color={colors.primary.main}
            />
          </View>
        )}
      </View>

      <Text
        variant="headlineSmall"
        style={[styles.title, { color: colors.text.primary }]}
      >
        {copy.title}
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.subtitle, { color: colors.text.secondary }]}
      >
        {copy.body}
      </Text>

      <Button
        mode="contained"
        onPress={primaryAction}
        style={styles.cta}
        contentStyle={styles.btnContent}
      >
        {primaryLabel}
      </Button>
      {onContinueSetup ? (
        <Button
          mode="text"
          onPress={onBackToDashboard}
          style={styles.secondaryCta}
        >
          {t('business.setup.success.backToDashboard', 'Back to dashboard')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 8 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center', fontWeight: '700', marginTop: 12 },
  subtitle: {
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
    lineHeight: 22,
  },
  cta: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  secondaryCta: { marginTop: 8, width: '100%', maxWidth: 420, alignSelf: 'center' },
  btnContent: { minHeight: 48 },
});
