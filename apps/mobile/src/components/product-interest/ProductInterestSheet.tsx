import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  itemName: string;
  submitting?: boolean;
  onDismiss: () => void;
  onSubmit: (note: string) => void;
}

export function ProductInterestSheet({
  visible,
  itemName,
  submitting,
  onDismiss,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) setNote('');
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: colors.overlay }]}
        onPress={onDismiss}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              maxHeight: height * 0.85,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              ...shadows.md,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={{ padding: spacing.md }}>
            {t('productInterest.dialogTitle', "I'm interested")}
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md }}>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
              {t(
                'productInterest.noteHelp',
                'Tell the seller about {{name}}. They will contact you outside the app.',
                { name: itemName }
              )}
            </Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              label={t('productInterest.noteLabel', 'Message (optional)')}
              value={note}
              onChangeText={setNote}
            />
          </ScrollView>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: spacing.sm,
              padding: spacing.md,
            }}
          >
            <Button mode="text" onPress={onDismiss} disabled={!!submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              loading={!!submitting}
              disabled={!!submitting}
              onPress={() => onSubmit(note)}
            >
              {t('productInterest.submit', 'Send interest')}
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
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
});
