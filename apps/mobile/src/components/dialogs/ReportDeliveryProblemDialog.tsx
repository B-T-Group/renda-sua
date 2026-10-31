import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  visible: boolean;
  submitting?: boolean;
  onDismiss: () => void;
  onSubmit: (description: string) => void;
};

export function ReportDeliveryProblemDialog({
  visible,
  submitting,
  onDismiss,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');

  const close = () => {
    setDescription('');
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={close}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              padding: spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={{ color: colors.text.primary }}>
            {t('orders.clientConfirm.cta.problem', 'Report a problem')}
          </Text>
          <TextInput
            mode="outlined"
            multiline
            value={description}
            onChangeText={setDescription}
            style={{ marginTop: spacing.md }}
            label={t('orders.clientConfirm.problemDescription', 'What happened? (optional)')}
          />
          <View style={styles.actions}>
            <Button onPress={close} disabled={submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button mode="contained" loading={submitting} disabled={submitting} onPress={() => onSubmit(description)}>
              {t('common.submit', 'Submit')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {},
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
});
