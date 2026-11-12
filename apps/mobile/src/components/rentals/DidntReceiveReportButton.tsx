import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from 'react-native-paper';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { reportNotReceived } from '../../services/rentalsApi';
import {
  notReceivedErrorKey,
  notReceivedFailure,
  showDidntReceiveLink,
} from '../../utils/rentals/rentalInspection';

type Step = 'confirm' | 'success' | 'retry' | 'terminal';

function codeOf(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const data = (error as { response?: { data?: { code?: string } } }).response?.data;
  return data?.code;
}

/** Re-checks the 30-minute window on a timer and whenever this screen is focused. */
export function useDidntReceiveWindow(
  enrolled: boolean,
  startedAt?: string | null
): boolean {
  const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => setNow(Date.now()), []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );
  useEffect(() => {
    const started = startedAt ? new Date(startedAt).getTime() : Number.NaN;
    const delay = started + 30 * 60 * 1000 - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = setTimeout(refresh, delay + 50);
    return () => clearTimeout(timer);
  }, [startedAt, refresh]);
  return showDidntReceiveLink({ enrolled, startedAt, now });
}

export function DidntReceiveReportButton({
  bookingId,
  reported = false,
  onReported,
  onWindowClosed,
}: {
  bookingId: string;
  reported?: boolean;
  onReported?: () => void;
  onWindowClosed?: () => void;
}) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const { flags, loaded } = useClientFlags();
  const [step, setStep] = useState<Step | null>(null);
  const [errorKey, setErrorKey] = useState('rentalInspection.didntReceiveStopped');
  const [hideLinkOnClose, setHideLinkOnClose] = useState(false);
  const [sending, setSending] = useState(false);
  const enabled = loaded && flags.rentals_not_received_report_enabled;

  const close = () => {
    if (sending) return;
    if (hideLinkOnClose) onWindowClosed?.();
    setStep(null);
  };

  const contactSupport = () => {
    if (hideLinkOnClose) onWindowClosed?.();
    setStep(null);
    navigation.navigate('SupportTickets');
  };

  const send = async () => {
    setSending(true);
    try {
      const result = await reportNotReceived(bookingId);
      onReported?.();
      if (result.alreadyReported) {
        setErrorKey('rentalInspection.didntReceiveAlready');
        setStep('terminal');
      } else {
        setStep('success');
      }
    } catch (error: unknown) {
      const code = codeOf(error);
      if (code === 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED') setHideLinkOnClose(true);
      if (notReceivedFailure(error) === 'retry') {
        setErrorKey('rentalInspection.didntReceiveFailed');
        setStep('retry');
      } else {
        setErrorKey(notReceivedErrorKey(code));
        setStep('terminal');
      }
    } finally {
      setSending(false);
    }
  };

  if (reported && step == null) {
    return (
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
        {t('rentalInspection.didntReceiveReported', 'Reported · support will follow up')}
      </Text>
    );
  }

  const title =
    step === 'success'
      ? t('rentalInspection.didntReceiveSuccessTitle', 'Support and the business were notified')
      : step === 'retry' || step === 'terminal'
        ? t('rentalInspection.didntReceiveErrorTitle', "Couldn't send the report")
        : t('rentalInspection.didntReceiveConfirmTitle', "Didn't receive the item?");
  const body =
    step === 'success'
      ? t('rentalInspection.didntReceiveSuccessBody', 'They will follow up. This rental stays as it is.')
      : step === 'retry'
        ? t(
            'rentalInspection.didntReceiveFailed',
            "Check your connection and try again."
          )
        : step === 'terminal'
          ? t(errorKey, "Couldn't send the report.")
          : t(
              'rentalInspection.didntReceiveConfirmBody',
              "We'll tell support and the business. Nothing is cancelled or refunded."
            );

  const contained = {
    buttonColor: colors.primary.main,
    textColor: colors.primary.contrast,
  };

  return (
    <>
      <Button
        mode="text"
        textColor={colors.primary.main}
        onPress={() => (enabled ? setStep('confirm') : navigation.navigate('SupportTickets'))}
      >
        {t('rentalInspection.didntReceive', "Didn't receive the item? Tell us")}
      </Button>
      <Modal visible={step != null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.scrim} onPress={close}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.sheet,
              shadows.md,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginBottom: insets.bottom,
              },
            ]}
          >
            <Text variant="titleMedium" style={{ color: colors.text.primary }}>
              {title}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
              {body}
            </Text>
            {step === 'success' ? (
              <Button mode="contained" onPress={close} style={{ marginTop: spacing.lg }} {...contained}>
                {t('rentalInspection.didntReceiveDone', 'Done')}
              </Button>
            ) : step === 'terminal' ? (
              <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
                <Button mode="contained" onPress={close} {...contained}>
                  {t('rentalInspection.didntReceiveOk', 'OK')}
                </Button>
                <Button mode="text" textColor={colors.primary.main} onPress={contactSupport}>
                  {t('rentalInspection.didntReceiveContactSupport', 'Contact support')}
                </Button>
              </View>
            ) : (
              <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
                <Button
                  mode="contained"
                  onPress={() => void send()}
                  loading={sending}
                  disabled={sending}
                  {...contained}
                >
                  {sending
                    ? t('rentalInspection.didntReceiveSending', 'Sending…')
                    : step === 'retry'
                      ? t('rentalInspection.didntReceiveRetry', 'Try again')
                      : t('rentalInspection.didntReceiveConfirm', 'Notify support and the business')}
                </Button>
                <Button mode="text" onPress={close} disabled={sending}>
                  {t('rentalInspection.sheetCancel', 'Cancel')}
                </Button>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
});
