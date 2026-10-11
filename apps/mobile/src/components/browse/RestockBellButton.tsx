import React, { memo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Snackbar } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface RestockBellButtonProps {
  itemId: string;
  itemName: string;
  enabled: boolean;
  onToggle: (itemId: string, enabled: boolean) => Promise<void>;
  disabled?: boolean;
  size?: number;
  /** Muted bell when alert is off */
  muted?: boolean;
}

function RestockBellButtonInner({
  itemId,
  itemName,
  enabled,
  onToggle,
  disabled = false,
  size = 24,
  muted = false,
}: RestockBellButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [toggling, setToggling] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [lastAction, setLastAction] = useState<'on' | 'off' | null>(null);

  const handlePress = async () => {
    if (disabled || toggling) return;

    const newEnabled = !enabled;
    setToggling(true);

    try {
      await onToggle(itemId, newEnabled);
      setLastAction(newEnabled ? 'on' : 'off');
      setSnackbarMessage(
        newEnabled
          ? t('restockAlerts.alertOn', 'Alert on')
          : t('restockAlerts.alertOffWithUndo', 'Alert off · Undo')
      );
      setSnackbarVisible(true);
    } catch (e: any) {
      // Silently fail, user can retry
    } finally {
      setToggling(false);
    }
  };

  const handleUndo = async () => {
    if (!lastAction) return;
    setSnackbarVisible(false);
    const undoEnabled = lastAction === 'off';
    try {
      await onToggle(itemId, undoEnabled);
    } catch {
      // Silently fail
    }
    setLastAction(null);
  };

  const iconName = enabled ? 'bell' : muted ? 'bell-outline' : 'bell-outline';
  const iconColor = enabled
    ? colors.primary.main
    : muted
    ? colors.text.disabled
    : colors.text.secondary;

  const accessibilityLabel = enabled
    ? t('restockAlerts.bellAccessibilityOn', 'Restock alert for {{item}}: on', {
        item: itemName,
      })
    : t('restockAlerts.bellAccessibilityOff', 'Restock alert for {{item}}: off', {
        item: itemName,
      });

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={disabled || toggling}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name={iconName} size={size} color={iconColor} />
      </Pressable>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        action={
          lastAction === 'off'
            ? {
                label: t('common.undo', 'Undo'),
                onPress: handleUndo,
              }
            : undefined
        }
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
});

export const RestockBellButton = memo(RestockBellButtonInner);
