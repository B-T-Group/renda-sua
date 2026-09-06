import React, { useEffect, useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Portal, Dialog, Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface MarkPaidCashExceptionDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (notes: string) => Promise<void>;
  submitting: boolean;
}

export function MarkPaidCashExceptionDialog({
  visible,
  onDismiss,
  onConfirm,
  submitting,
}: MarkPaidCashExceptionDialogProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) setNotes('');
  }, [visible]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={submitting ? undefined : onDismiss} dismissable={!submitting}>
        <Dialog.Title style={{ color: colors.text.primary }}>
          {t('agent.orders.payAtDelivery.cashTitle', { defaultValue: 'Cash exception' })}
        </Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: colors.warning.main, marginBottom: 12 }}>
            {t('agent.orders.payAtDelivery.cashWarning', {
              defaultValue:
                'Use this only if the client cannot complete mobile payment at delivery. The business will need to reconcile this manually.',
            })}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 6 }}>
            {t('agent.orders.payAtDelivery.cashNotesLabel', { defaultValue: 'Notes (optional)' })}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.divider,
                color: colors.text.primary,
                borderRadius: borderRadius.sm,
              },
              typography.body2 as object,
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('agent.orders.payAtDelivery.cashNotesLabel', { defaultValue: 'Notes (optional)' })}
            placeholderTextColor={colors.text.disabled}
            multiline
            editable={!submitting}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={submitting}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            mode="contained"
            buttonColor={colors.warning.main}
            textColor={colors.onDark}
            onPress={() => void onConfirm(notes)}
            loading={submitting}
            disabled={submitting}
          >
            {t('agent.orders.payAtDelivery.submitCash', { defaultValue: 'Mark paid in cash' })}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, textAlignVertical: 'top' },
});
