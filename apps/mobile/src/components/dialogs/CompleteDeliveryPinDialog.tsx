import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { ActionLoadingDialog } from '../feedback/ActionLoadingDialog';

const PIN_LEN = 4;

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (pin: string) => void;
  onSubmitSharedPin?: () => void;
  submitting: boolean;
  errorText: string | null;
  onPinEdited?: () => void;
  autoSharedPin?: string | null;
  resolvingSharedPin?: boolean;
  noSharedPin?: boolean;
};

export function CompleteDeliveryPinDialog({
  visible,
  onDismiss,
  onSubmit,
  onSubmitSharedPin,
  submitting,
  errorText,
  onPinEdited,
  autoSharedPin,
  resolvingSharedPin = false,
  noSharedPin = false,
}: Props) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const [digits, setDigits] = useState<string[]>(() => Array(PIN_LEN).fill(''));
  const [showManual, setShowManual] = useState(false);
  const refs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (!visible) return;
    setDigits(Array(PIN_LEN).fill(''));
    setShowManual(false);
    if (!autoSharedPin) {
      const timer = setTimeout(() => refs.current[0]?.focus(), 80);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, autoSharedPin]);

  const setRef = (i: number) => (el: TextInput | null) => {
    refs.current[i] = el;
  };

  const maybeAutoSubmit = useCallback(
    (next: string[]) => {
      const joined = next.join('');
      if (joined.length === PIN_LEN && next.every((d) => d !== '')) {
        setTimeout(() => onSubmit(joined), 0);
      }
    },
    [onSubmit]
  );

  const handleChange = useCallback(
    (index: number, text: string) => {
      const cleaned = text.replace(/\D/g, '');
      if (cleaned.length > 1) {
        const pasted = cleaned.slice(0, PIN_LEN).split('');
        const next = Array(PIN_LEN)
          .fill('')
          .map((_, i) => pasted[i] ?? '');
        setDigits(next);
        onPinEdited?.();
        const lastIdx = Math.min(pasted.length, PIN_LEN) - 1;
        setTimeout(() => refs.current[lastIdx]?.focus(), 0);
        maybeAutoSubmit(next);
        return;
      }
      if (!cleaned) {
        setDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
        onPinEdited?.();
        if (index > 0) setTimeout(() => refs.current[index - 1]?.focus(), 0);
        return;
      }
      const digit = cleaned.slice(-1);
      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;
        maybeAutoSubmit(next);
        return next;
      });
      onPinEdited?.();
      if (index < PIN_LEN - 1) setTimeout(() => refs.current[index + 1]?.focus(), 0);
    },
    [onPinEdited, maybeAutoSubmit]
  );

  const useSharedPin = !!autoSharedPin && !showManual;

  return (
    <>
      <Portal>
      <Dialog visible={visible && !submitting} onDismiss={submitting ? undefined : onDismiss} dismissable={!submitting}>
        <Dialog.Title style={{ color: colors.text.primary }}>
          {t('orders.completeDelivery.title', 'Finaliser la livraison')}
        </Dialog.Title>
        <Dialog.Content>
          {resolvingSharedPin ? (
            <Text style={[typography.body2, { color: colors.text.secondary }]}>
              {t('orders.completeDelivery.resolvingPin', 'Looking for shared delivery PIN…')}
            </Text>
          ) : null}

          {noSharedPin && !resolvingSharedPin ? (
            <Text style={[typography.body2, { color: colors.text.secondary, marginBottom: 12 }]}>
              {t(
                'orders.messaging.deliveryPin.agentNoPin',
                'The client has not shared a delivery PIN in the order chat yet. Ask them to tap Send delivery PIN, or enter the PIN manually below.'
              )}
            </Text>
          ) : null}

          {useSharedPin ? (
            <View>
              <Text style={[typography.body2, { color: colors.text.secondary, marginBottom: 8 }]} role="status">
                {t(
                  'orders.completeDelivery.usingSharedPin',
                  'Using the delivery PIN shared by the client in order chat.'
                )}
              </Text>
              <Text
                style={[
                  typography.headlineSmall,
                  {
                    color: colors.text.primary,
                    textAlign: 'center',
                    letterSpacing: 8,
                    marginVertical: 12,
                  },
                ]}
              >
                {autoSharedPin}
              </Text>
              <Button mode="text" compact onPress={() => setShowManual(true)}>
                {t('orders.completeDelivery.enterManually', 'Enter PIN manually instead')}
              </Button>
            </View>
          ) : null}

          {(!useSharedPin && !resolvingSharedPin) || showManual ? (
            <>
              <Text style={[typography.body2, { color: colors.text.secondary, marginBottom: 16 }]}>
                {t('orders.completeDelivery.instructionPinOnly', 'Enter the 4-digit delivery PIN provided by the client.')}
              </Text>
              <View style={styles.pinRow}>
                {digits.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={setRef(i)}
                    value={d}
                    onChangeText={(txt) => handleChange(i, txt)}
                    keyboardType="number-pad"
                    maxLength={1}
                    editable={!submitting}
                    selectTextOnFocus
                    style={[
                      styles.pinCell,
                      {
                        borderColor: colors.divider,
                        borderRadius: borderRadius.md,
                        color: colors.text.primary,
                        backgroundColor: colors.surface,
                      },
                      typography.h5 as object,
                    ]}
                    textAlign="center"
                    textAlignVertical="center"
                    accessibilityLabel={t('orders.completeDelivery.pinDigitA11y', 'PIN digit {{n}} of 4', {
                      n: i + 1,
                    })}
                  />
                ))}
              </View>
            </>
          ) : null}

          {errorText ? (
            <Text style={[typography.body2, { color: colors.error.main, marginTop: 12 }]}>{errorText}</Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          {useSharedPin && onSubmitSharedPin ? (
            <Button mode="contained" onPress={onSubmitSharedPin} disabled={submitting}>
              {t('orders.completeDelivery.submit', 'Complete delivery')}
            </Button>
          ) : null}
        </Dialog.Actions>
      </Dialog>
      </Portal>
      <ActionLoadingDialog
        visible={submitting}
        action="complete_delivery"
        message={t('orders.completeDelivery.completing', { defaultValue: 'Completing delivery…' })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  pinCell: {
    width: 52,
    height: 56,
    borderWidth: 1,
    fontWeight: '600',
    paddingVertical: 0,
    paddingHorizontal: 0,
    lineHeight: 56,
  },
});
