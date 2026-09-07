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
  autoSharedPin?: string | null;
  resolvingSharedPin?: boolean;
  noSharedPin?: boolean;
};

/** Business enters or confirms the client pickup PIN shared in chat. */
export function BusinessConfirmPickupPinDialog({
  visible,
  onDismiss,
  onSubmit,
  onSubmitSharedPin,
  submitting,
  errorText,
  autoSharedPin,
  resolvingSharedPin = false,
  noSharedPin = false,
}: Props) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const [digits, setDigits] = useState<string[]>(() => Array(PIN_LEN).fill(''));
  const [showManual, setShowManual] = useState(false);
  const refs = useRef<Array<TextInput | null>>([]);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      submitLockRef.current = false;
      return;
    }
    setDigits(Array(PIN_LEN).fill(''));
    setShowManual(false);
    submitLockRef.current = false;
    if (!autoSharedPin) {
      const timer = setTimeout(() => refs.current[0]?.focus(), 80);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, autoSharedPin]);

  useEffect(() => {
    if (!submitting) submitLockRef.current = false;
  }, [submitting]);

  const setRef = useCallback(
    (i: number) => (el: TextInput | null) => {
      refs.current[i] = el;
    },
    []
  );

  const submitOnce = useCallback(
    (joined: string) => {
      if (submitting || submitLockRef.current) return;
      if (joined.length !== PIN_LEN) return;
      submitLockRef.current = true;
      onSubmit(joined);
    },
    [onSubmit, submitting]
  );

  const maybeAutoSubmit = useCallback(
    (next: string[]) => {
      const joined = next.join('');
      if (joined.length === PIN_LEN && next.every((d) => d !== '')) {
        setTimeout(() => submitOnce(joined), 0);
      }
    },
    [submitOnce]
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
        const lastIdx = Math.min(pasted.length, PIN_LEN) - 1;
        setTimeout(() => refs.current[lastIdx]?.focus(), 0);
        maybeAutoSubmit(next);
        return;
      }
      const digit = cleaned.slice(-1);
      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;
        if (digit && index < PIN_LEN - 1) {
          setTimeout(() => refs.current[index + 1]?.focus(), 0);
        }
        maybeAutoSubmit(next);
        return next;
      });
    },
    [maybeAutoSubmit]
  );

  const pin = digits.join('');
  const useSharedPin = !!autoSharedPin && !showManual;
  const canSubmitManual = pin.length === PIN_LEN && !submitting;

  return (
    <>
      <Portal>
        <Dialog visible={visible && !submitting} onDismiss={onDismiss}>
          <Dialog.Title>
            {t('business.orders.confirmPickupPinTitle', 'Confirm pickup with PIN')}
          </Dialog.Title>
          <Dialog.Content>
            {resolvingSharedPin ? (
              <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                {t('business.orders.resolvingPickupPin', 'Looking for shared pickup PIN…')}
              </Text>
            ) : null}

            {noSharedPin && !resolvingSharedPin ? (
              <Text
                variant="bodyMedium"
                style={{ color: colors.text.secondary, marginBottom: 12 }}
              >
                {t(
                  'business.orders.noSharedPickupPin',
                  'The client has not sent a pickup PIN in the order chat yet. Ask them to tap Send PIN, or enter it manually below.'
                )}
              </Text>
            ) : null}

            {useSharedPin ? (
              <View>
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.text.secondary, marginBottom: 8 }}
                >
                  {t(
                    'business.orders.usingSharedPickupPin',
                    'Using the pickup PIN shared by the client in order chat.'
                  )}
                </Text>
                <Text
                  variant="displaySmall"
                  style={{
                    textAlign: 'center',
                    letterSpacing: 6,
                    fontFamily: 'monospace',
                    marginVertical: 8,
                  }}
                >
                  {autoSharedPin}
                </Text>
                <Button mode="text" compact onPress={() => setShowManual(true)}>
                  {t('business.orders.enterPickupPinManually', 'Enter PIN manually instead')}
                </Button>
              </View>
            ) : null}

            {(!useSharedPin && !resolvingSharedPin) || showManual ? (
              <>
                <Text
                  variant="bodyMedium"
                  style={{ marginBottom: 12, color: colors.text.secondary }}
                >
                  {t(
                    'business.orders.confirmPickupPinBody',
                    'Ask the customer for their 4-digit pickup PIN, then enter it to confirm and capture payment.'
                  )}
                </Text>
                <View style={styles.row}>
                  {digits.map((d, i) => (
                    <TextInput
                      key={i}
                      ref={setRef(i)}
                      value={d}
                      onChangeText={(text) => handleChange(i, text)}
                      keyboardType="number-pad"
                      maxLength={PIN_LEN}
                      editable={!submitting}
                      style={[
                        styles.box,
                        {
                          borderColor: colors.divider,
                          borderRadius: borderRadius.sm,
                          color: colors.text.primary,
                          fontSize: typography.title.fontSize,
                          fontFamily: typography.title.fontFamily,
                        },
                      ]}
                      accessibilityLabel={t('business.orders.pinDigitA11y', 'PIN digit {{n}}', {
                        n: i + 1,
                      })}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {errorText ? (
              <Text style={{ color: colors.error.main, marginTop: 12 }}>{errorText}</Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={onDismiss} disabled={submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            {useSharedPin && onSubmitSharedPin ? (
              <Button mode="contained" onPress={onSubmitSharedPin} disabled={submitting}>
                {t('orderActions.confirmClientPickup', 'Confirm pickup')}
              </Button>
            ) : (
              <Button
                mode="contained"
                disabled={!canSubmitManual}
                onPress={() => submitOnce(pin)}
              >
                {t('orderActions.confirmClientPickup', 'Confirm pickup')}
              </Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <ActionLoadingDialog visible={submitting} action="confirm_order" />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  box: {
    width: 48,
    height: 56,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
});
