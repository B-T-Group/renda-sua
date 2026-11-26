import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { MobileMoneyConfirmIllustration } from '../../illustrations/MobileMoneyConfirmIllustration';
import type { PayBreakdown } from '../../../utils/rentals/payBreakdown';
import { PayBreakdownView } from '../PayBreakdownView';

export type PayWaitingPhase = 'waiting' | 'failed' | 'stalled';

interface Props {
  phase: PayWaitingPhase;
  rail: 'card' | 'momo' | 'wallet';
  breakdown?: PayBreakdown | null;
  place?: string;
  starting: boolean;
  onRetry: () => void;
  onSupport: () => void;
}

/** Pay & start after the tap: card confirming / failed / retry, MoMo "Approve on your phone" (05b). */
export function PayWaitingPanel(props: Props) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const card = props.rail === 'card';
  const waiting = props.phase === 'waiting';
  const failed = props.phase === 'failed';
  return (
    <View testID={`pay-waiting-${props.phase}-${props.rail}`} style={{ padding: spacing.md, gap: spacing.md, alignItems: 'stretch' }}>
      <View style={{ alignItems: 'center' }}>
        {waiting && !card ? <MobileMoneyConfirmIllustration /> : null}
        {waiting && card ? <ActivityIndicator size="large" color={colors.primary.main} /> : null}
        {failed ? <MaterialCommunityIcons name="alert-circle-outline" size={40} color={colors.error.main} /> : null}
      </View>
      <Text style={[typography.h5, { color: colors.text.primary, textAlign: 'center' }]}>
        {waiting
          ? card
            ? t('rentals.payAtPickup.cardWaitingTitle', 'Confirming your card payment…')
            : t('orders.momoAwaiting.waitingTitle', 'Approve on your phone')
          : failed
            ? t('orders.momoAwaiting.failedTitle', 'Payment failed')
            : t('rentalInspection.startDelayedTitle', 'Payment succeeded, but the rental has not started.')}
      </Text>
      <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center' }]}>
        {waiting
          ? card
            ? t('rentals.payAtPickup.cardWaitingBody', 'Stay at the counter. This page updates when the payment goes through, then the business hands you the item.')
            : t('orders.momoAwaiting.waitingBody', 'Approve the request on your phone. This page updates when payment succeeds.')
          : failed
            ? card
              ? t('rentals.payAtPickup.cardFailed', 'Card payment didn’t go through. Try again or use another card.')
              : t('orders.momoAwaiting.failedBody', 'The mobile money request did not succeed. You can try again.')
            : t('rentalInspection.startDelayedBody', 'You can retry the start, or contact support.')}
      </Text>
      {props.breakdown && props.phase !== 'stalled' ? <PayBreakdownView breakdown={props.breakdown} /> : null}
      {waiting && !card && props.place ? (
        <View style={[styles.row, { backgroundColor: colors.warningTint, borderRadius: borderRadius.md, padding: spacing.sm }]}>
          <MaterialCommunityIcons name="hand-back-right-outline" size={18} color={colors.warning.dark} />
          <Text style={{ color: colors.warning.dark, marginLeft: 8, flex: 1 }}>
            {t('rentals.pay.stayCounter', 'Stay at the counter. {{place}} hands you the item as soon as the payment goes through.', { place: props.place })}
          </Text>
        </View>
      ) : null}
      {failed ? (
        <>
          <Button mode="contained" icon="refresh" buttonColor={colors.primary.main} loading={props.starting} onPress={props.onRetry} style={{ minHeight: 48 }}>
            {t('common.retry', 'Retry')}
          </Button>
          <Text testID="pay-retry-until" style={{ color: colors.text.secondary, textAlign: 'center', fontSize: 13 }}>
            {t('rentals.pay.retryUntil', 'You can try again until 23:59 today.')}
          </Text>
        </>
      ) : null}
      {props.phase === 'stalled' ? (
        <>
          <Button mode="contained" buttonColor={colors.primary.main} loading={props.starting} onPress={props.onRetry}>
            {t('rentalInspection.retryStart', 'Retry start')}
          </Button>
          <Button mode="outlined" onPress={props.onSupport}>
            {t('rentalInspection.contactSupport', 'Contact support')}
          </Button>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
