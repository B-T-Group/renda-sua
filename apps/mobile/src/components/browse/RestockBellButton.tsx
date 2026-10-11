import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

export interface RestockBellButtonProps {
  itemId: string;
  itemName: string;
  /** Filled bell = alert on; outline + muted = off or expired. */
  enabled: boolean;
  busy?: boolean;
  onToggle: (itemId: string, nextEnabled: boolean) => void;
}

/** Icon-first bell, 44x44 touch target. Toast/undo is owned by the screen. */
function RestockBellButtonInner({
  itemId,
  itemName,
  enabled,
  busy = false,
  onToggle,
}: RestockBellButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const label = enabled
    ? t('restockAlerts.bellAccessibilityOn', 'Restock alert for {{item}}: on', { item: itemName })
    : t('restockAlerts.bellAccessibilityOff', 'Restock alert for {{item}}: off', { item: itemName });
  const hint = enabled
    ? t('restockAlerts.bellOn', "We'll tell you when it's back")
    : t('restockAlerts.bellOff', "Notify me when it's back");

  return (
    <Pressable
      onPress={() => onToggle(itemId, !enabled)}
      disabled={busy}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: enabled, disabled: busy, busy }}
      hitSlop={4}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.primary.main} />
      ) : (
        <MaterialCommunityIcons
          name={enabled ? 'bell' : 'bell-outline'}
          size={24}
          color={enabled ? colors.primary.main : colors.text.disabled}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const RestockBellButton = memo(RestockBellButtonInner);
