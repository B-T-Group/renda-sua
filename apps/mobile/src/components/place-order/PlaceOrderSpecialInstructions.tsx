import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { IconButton, Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

interface PlaceOrderSpecialInstructionsProps {
  value: string;
  onChangeText: (value: string) => void;
  numberOfLines?: number;
}

/**
 * Collapsed by default so checkout stays short. Expanding reveals the notes field.
 */
export function PlaceOrderSpecialInstructions({
  value,
  onChangeText,
  numberOfLines = 4,
}: PlaceOrderSpecialInstructionsProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const [open, setOpen] = useState(() => value.trim().length > 0);

  const hide = () => {
    onChangeText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t(
          'client.placeOrder.addNotes',
          'Add special instructions'
        )}
        style={[
          styles.collapsed,
          {
            borderColor: colors.divider,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="note-plus-outline"
          size={20}
          color={colors.primary.main}
        />
        <Text
          style={[
            typography.body2,
            { color: colors.primary.main, fontWeight: '600', flex: 1 },
          ]}
        >
          {t('client.placeOrder.addNotes', 'Add special instructions')}
        </Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={colors.text.secondary}
        />
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.open,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="titleSmall" style={{ flex: 1, color: colors.text.primary }}>
          {t('client.placeOrder.notes', 'Special instructions (optional)')}
        </Text>
        <IconButton
          icon="close"
          size={18}
          onPress={hide}
          accessibilityLabel={t('common.close', 'Close')}
          style={{ margin: 0 }}
        />
      </View>
      <TextInput
        mode="outlined"
        multiline
        value={value}
        onChangeText={onChangeText}
        numberOfLines={numberOfLines}
        placeholder={t(
          'client.placeOrder.notesPlaceholder',
          'Allergies, gate code, spice level…'
        )}
        style={{ minHeight: numberOfLines * 22 }}
        outlineStyle={{ borderRadius: borderRadius.md }}
        autoFocus={value.trim().length === 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  open: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
