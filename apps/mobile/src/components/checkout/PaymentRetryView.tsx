import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { NoticeBanner } from '@/components/common/NoticeBanner';

export interface PaymentRetryViewProps {
  /** Human-readable error title (e.g., "Payment didn't go through") */
  errorTitle: string;
  /** Specific error reason (e.g., "Insufficient MoMo balance") */
  errorReason: string;
  /** Tips to resolve the issue */
  tips: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  /** Callback for "Try again" button */
  onRetry: () => void;
  /** Optional: Callback for "Edit phone number" button */
  onEditPhone?: () => void;
  /** Optional: Callback for "Change payment method" button (only if market allows alternatives) */
  onChangeMethod?: () => void;
  /** Optional: Secondary action (e.g., "Back to order") */
  onSecondary?: () => void;
  /** Optional: Label for secondary action button */
  secondaryLabel?: string;
  /** Whether retry is in progress */
  retrying?: boolean;
  /** Whether to show "order still reserved" trust banner */
  showOrderReservedBanner?: boolean;
  /** Optional contact support info */
  supportWhatsApp?: string;
  /** Optional: Custom retry button label (defaults to "Try again") */
  retryLabel?: string;
}

/**
 * Payment retry/error screen component showing plain-language errors,
 * actionable tips, and next-step buttons for failed mobile money payments.
 */
export function PaymentRetryView({
  errorTitle,
  errorReason,
  tips,
  onRetry,
  onEditPhone,
  onChangeMethod,
  onSecondary,
  secondaryLabel,
  retrying = false,
  showOrderReservedBanner = true,
  supportWhatsApp,
  retryLabel,
}: PaymentRetryViewProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          alignItems: 'center',
        }}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: colors.error.light,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          <MaterialCommunityIcons name="wallet-outline" size={48} color={colors.error.main} />
          <View style={styles.errorBadge}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error.main} />
          </View>
        </View>

        <Text
          variant="headlineSmall"
          style={{
            marginTop: spacing.md,
            textAlign: 'center',
            fontWeight: '700',
            color: colors.error.main,
          }}
        >
          {errorTitle}
        </Text>

        <Text
          variant="bodyLarge"
          style={{
            marginTop: spacing.sm,
            textAlign: 'center',
            color: colors.text.primary,
          }}
        >
          {errorReason}
        </Text>

        {showOrderReservedBanner ? (
          <NoticeBanner
            tone="info"
            icon="shield-check-outline"
            message={t(
              'checkout.orderStillReserved',
              "Good news: your order is still reserved! We've saved your items while you complete your payment."
            )}
            style={{ marginTop: spacing.lg, width: '100%' }}
          />
        ) : null}

        <View
          style={[
            styles.tipsContainer,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              borderColor: colors.divider,
              marginTop: spacing.lg,
              width: '100%',
            },
          ]}
        >
          <Text variant="titleSmall" style={{ marginBottom: spacing.md }}>
            {t('checkout.tipsToResolve', 'Tips to resolve this')}
          </Text>

          {tips.map((tip, index) => (
            <View key={index} style={[styles.tipRow, { marginBottom: index < tips.length - 1 ? spacing.md : 0 }]}>
              <View
                style={[
                  styles.tipIcon,
                  {
                    backgroundColor: colors.primaryTint,
                    borderRadius: borderRadius.sm,
                  },
                ]}
              >
                <MaterialCommunityIcons name={tip.icon as any} size={20} color={colors.primary.main} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="titleSmall" style={{ color: colors.text.primary }}>
                  {tip.title}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
                  {tip.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.sm }}>
          <Button
            mode="contained"
            icon="reload"
            loading={retrying}
            disabled={retrying}
            onPress={onRetry}
            contentStyle={{ height: 52 }}
          >
            {retryLabel ?? t('checkout.tryAgain', 'Try again')}
          </Button>

          {onChangeMethod ? (
            <Button mode="outlined" icon="swap-horizontal" onPress={onChangeMethod} disabled={retrying}>
              {t('checkout.changePaymentMethod', 'Change payment method')}
            </Button>
          ) : null}

          {onEditPhone ? (
            <Button mode="outlined" icon="pencil-outline" onPress={onEditPhone} disabled={retrying}>
              {t('checkout.editPhoneNumber', 'Edit phone number')}
            </Button>
          ) : null}

          {onSecondary ? (
            <Button mode="outlined" onPress={onSecondary} disabled={retrying}>
              {secondaryLabel ?? t('common.back', 'Back')}
            </Button>
          ) : null}

          {supportWhatsApp ? (
            <Button mode="text" icon="whatsapp" onPress={() => {}} compact style={{ marginTop: spacing.sm }}>
              {t('checkout.contactSupport', 'Need help? Contact us on WhatsApp')}
            </Button>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  errorBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
  },
  tipsContainer: {
    borderWidth: 1,
    padding: 16,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
