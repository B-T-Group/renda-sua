import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from 'react-native-paper';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { reportNotReceived } from '../../services/rentalsApi';
import { notReceivedErrorKey } from '../../utils/rentals/rentalInspection';

type Step = 'confirm' | 'success' | 'error';

function codeOf(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const data = (error as { response?: { data?: { code?: string } } }).response?.data;
  return data?.code;
}

export function DidntReceiveReportButton({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const { flags, loaded } = useClientFlags();
  const [step, setStep] = useState<Step | null>(null);
  const [errorKey, setErrorKey] = useState('rentalInspection.didntReceiveFailed');
  const [sending, setSending] = useState(false);
  const enabled = loaded && flags.rentals_not_received_report_enabled;

  const close = () => {
    if (!sending) setStep(null);
  };

  const send = async () => {
    setSending(true);
    try {
      await reportNotReceived(bookingId);
      setStep('success');
    } catch (error: unknown) {
      setErrorKey(notReceivedErrorKey(codeOf(error)));
      setStep('error');
    } finally {
      setSending(false);
    }
  };

  const title =
    step === 'success'
      ? t('rentalInspection.didntReceiveSuccessTitle', 'Support and the business were notified')
      : step === 'error'
        ? t('rentalInspection.didntReceiveErrorTitle', "Couldn't send the report")
        : t('rentalInspection.didntReceiveConfirmTitle', "Didn't receive the item?");
  const body =
    step === 'success'
      ? t('rentalInspection.didntReceiveSuccessBody', 'They will follow up. This rental stays as it is.')
      : step === 'error'
        ? t(errorKey, "We couldn't send that. Try again.")
        : t(
            'rentalInspection.didntReceiveConfirmBody',
            "We'll tell support and the business. Nothing is cancelled or refunded."
          );

  return (
    <>
      <Button
        mode="text"
        textColor={colors.primary.main}
        onPress={() =>
          enabled ? setStep('confirm') : navigation.navigate('SupportTickets')
        }
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
              <Button mode="contained" onPress={close} style={{ marginTop: spacing.lg }}>
                {t('rentalInspection.didntReceiveDone', 'Done')}
              </Button>
            ) : (
              <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
                <Button mode="contained" onPress={() => void send()} loading={sending} disabled={sending}>
                  {sending
                    ? t('rentalInspection.didntReceiveSending', 'Sending…')
                    : step === 'error'
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
