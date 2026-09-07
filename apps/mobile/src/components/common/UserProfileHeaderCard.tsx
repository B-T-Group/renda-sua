import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { shadows } from '@/theme/shadows';

export interface UserProfileHeaderCardProps {
  /** User display name */
  displayName: string;
  /** Initials fallback when no photo is available */
  initials: string;
  /** Remote photo URI; renders avatar fallback when null/undefined */
  photoUri?: string | null;
  /** Secondary line below name (email, phone, etc.) */
  contactText?: string | null;
  onPress: () => void;
}

/**
 * Shared profile header card used at the top of all persona menus.
 * Tapping opens the Profile screen. Shows profile photo or an initials
 * avatar, display name, optional secondary contact text, and an edit
 * affordance. Appearance is identical across Client, Business, and
 * Delivery Agent — only the data provided differs.
 */
export function UserProfileHeaderCard({
  displayName,
  initials,
  photoUri,
  contactText,
  onPress,
}: UserProfileHeaderCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('menuTab.viewProfile', 'View profile')}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          borderColor: colors.divider,
          marginBottom: spacing.lg,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {/* Avatar */}
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={[styles.avatar, { borderRadius: AVATAR_SIZE / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: colors.primary.main,
              borderRadius: AVATAR_SIZE / 2,
            },
          ]}
        >
          <Text
            variant="titleMedium"
            style={{ color: colors.primary.contrast, fontWeight: '700' }}
          >
            {initials}
          </Text>
        </View>
      )}

      {/* Name + contact */}
      <View style={styles.info}>
        <Text
          variant="titleSmall"
          style={[styles.name, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {contactText ? (
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary }}
            numberOfLines={1}
          >
            {contactText}
          </Text>
        ) : null}
      </View>

      {/* Edit badge */}
      <View
        style={[
          styles.editBadge,
          {
            backgroundColor: colors.primaryTint,
            borderRadius: borderRadius.sm,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="pencil-outline"
          size={14}
          color={colors.primary.main}
        />
        <Text
          variant="labelSmall"
          style={{ color: colors.primary.main, fontWeight: '700' }}
        >
          {t('common.edit', 'Edit')}
        </Text>
      </View>
    </Pressable>
  );
}

const AVATAR_SIZE = 52;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontWeight: '600',
  },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
