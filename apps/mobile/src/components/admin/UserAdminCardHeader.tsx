/**
 * Reusable name + contact row used at the top of both ClientUserCard and
 * AgentAdminCard. Shows initials avatar, full name, email, and phone.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface UserAdminCardHeaderProps {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  /** Accent color for the avatar background (defaults to primary.main + opacity). */
  accentColor?: string;
}

export function UserAdminCardHeader({
  firstName,
  lastName,
  email,
  phone,
  accentColor,
}: UserAdminCardHeaderProps) {
  const { colors, typography, borderRadius } = useTheme();
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const bg = accentColor ?? colors.primary.main + '22';

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: bg, borderRadius: borderRadius.full ?? 99 },
        ]}
      >
        <Text
          style={[
            styles.initials,
            { color: colors.primary.main },
          ]}
        >
          {initials}
        </Text>
      </View>
      <View style={styles.body}>
        <Text
          style={[typography.subtitle1, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {firstName} {lastName}
        </Text>
        {email ? (
          <Text
            style={[typography.caption, { color: colors.text.secondary }]}
            numberOfLines={1}
          >
            {email}
          </Text>
        ) : null}
        {phone ? (
          <Text
            style={[typography.caption, { color: colors.text.secondary }]}
            numberOfLines={1}
          >
            {phone}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initials: {
    fontWeight: '700',
    fontSize: 16,
    includeFontPadding: false,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
