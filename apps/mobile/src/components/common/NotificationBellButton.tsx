import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';

export interface NotificationBellButtonProps {
  unreadCount?: number;
  onPress: () => void;
  /** Extra margin when placed beside other header controls. */
  style?: object;
}

/** Header bell that opens the notification center; filled badge icon when unread > 0. */
export function NotificationBellButton({
  unreadCount = 0,
  onPress,
  style,
}: NotificationBellButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('notifications.center.title', 'Activity')}
      accessibilityHint={
        hasUnread
          ? t('notifications.center.unreadHint', '{{count}} unread notifications', {
              count: unreadCount,
            })
          : undefined
      }
      style={[styles.btn, style]}
    >
      <MaterialCommunityIcons
        name={hasUnread ? 'bell-badge' : 'bell-outline'}
        size={24}
        color={hasUnread ? colors.primary.main : colors.text.secondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
});
