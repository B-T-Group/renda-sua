import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useBusinessFollow } from '../../hooks/useBusinessFollow';
import { SaveFavoritesSheet } from '../dialogs/SaveFavoritesSheet';

export interface BusinessFollowButtonProps {
  businessId: string | null | undefined;
  initiallyFollowing?: boolean;
  size?: number;
  onFollowingChange?: (following: boolean) => void;
}

export function BusinessFollowButton({
  businessId,
  initiallyFollowing = false,
  size = 22,
  onFollowingChange,
}: BusinessFollowButtonProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, shadows } = useTheme();
  const {
    following,
    saveSheetOpen,
    pendingOptimistic,
    toggleFollow,
    closeSaveSheet,
    beginAuthForFollow,
  } = useBusinessFollow(businessId, initiallyFollowing);

  const label = useMemo(
    () =>
      following
        ? t('business.follows.unfollow', 'Unfollow store')
        : t('business.follows.follow', 'Follow store'),
    [following, t]
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: following }}
        hitSlop={8}
        onPress={(e) => {
          e?.stopPropagation?.();
          void (async () => {
            const next = await toggleFollow();
            onFollowingChange?.(next);
          })();
        }}
        style={[
          styles.btn,
          shadows.sm,
          {
            borderRadius: borderRadius.full ?? 999,
            backgroundColor: colors.background.paper,
            transform: [{ scale: pendingOptimistic ? 1.15 : 1 }],
          },
        ]}
      >
        <MaterialCommunityIcons
          name={following ? 'store-check' : 'store-plus-outline'}
          size={size}
          color={following ? colors.primary.main : colors.text.secondary}
        />
      </Pressable>
      <SaveFavoritesSheet
        visible={saveSheetOpen}
        onDismiss={closeSaveSheet}
        onBeginAuth={beginAuthForFollow}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
