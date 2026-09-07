import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { FailedDeliveryReason } from '../../types/agent';

export interface FailDeliveryReasonDialogProps {
  visible: boolean;
  orderNumber: string;
  reasons: FailedDeliveryReason[];
  selectedReasonId: string;
  notes: string;
  loading: boolean;
  onSelectReason: (id: string) => void;
  onChangeNotes: (text: string) => void;
  onDismiss: () => void;
  onConfirm: () => void;
}

export function FailDeliveryReasonDialog({
  visible,
  orderNumber,
  reasons,
  selectedReasonId,
  notes,
  loading,
  onSelectReason,
  onChangeNotes,
  onDismiss,
  onConfirm,
}: FailDeliveryReasonDialogProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const labelFor = (r: FailedDeliveryReason) =>
    lang === 'fr' ? (r.reason_fr ?? r.reason ?? r.reason_en ?? '') : (r.reason_en ?? r.reason ?? r.reason_fr ?? '');

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} dismissable={!loading}>
        <Dialog.Title style={{ color: colors.text.primary }}>
          {t('agent.orders.failDialog.title', 'Delivery failed')} #{orderNumber}
        </Dialog.Title>
        <Dialog.ScrollArea style={{ maxHeight: 360 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: 8 }}>
              {t('agent.orders.failDialog.reasonLabel', 'Reason')}
            </Text>
            {reasons
              .filter((r) => r.is_active)
              .map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => onSelectReason(r.id)}
                  style={[
                    styles.reasonRow,
                    {
                      borderColor: selectedReasonId === r.id ? colors.primary.main : colors.divider,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                >
                  <Text style={[typography.body2 as object, { color: colors.text.primary }]}>{labelFor(r)}</Text>
                </Pressable>
              ))}
            <Text variant="labelLarge" style={{ color: colors.text.secondary, marginTop: 12, marginBottom: 6 }}>
              {t('agent.orders.failDialog.notesLabel', 'Notes (optional)')}
            </Text>
            <TextInput
              style={[
                styles.notes,
                typography.body2 as object,
                { borderColor: colors.divider, color: colors.text.primary, borderRadius: borderRadius.sm },
              ]}
              value={notes}
              onChangeText={onChangeNotes}
              placeholder={t('agent.orders.failDialog.notesPlaceholder', 'Notes…')}
              placeholderTextColor={colors.text.disabled}
              multiline
              editable={!loading}
            />
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button mode="contained" buttonColor={colors.error.main} onPress={onConfirm} loading={loading} disabled={!selectedReasonId}>
            {t('agent.orders.failDialog.confirm', 'Confirm failure')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 8 },
  reasonRow: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  notes: {
    borderWidth: 1,
    minHeight: 72,
    padding: 10,
    textAlignVertical: 'top',
  },
});
