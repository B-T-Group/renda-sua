import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useItemLike } from '../../hooks/useItemLike';
import { SaveFavoritesSheet } from '../dialogs/SaveFavoritesSheet';

export interface ItemLikeButtonProps {
  itemId: string | null | undefined;
  initiallyLiked?: boolean;
  size?: number;
  onLikedChange?: (liked: boolean) => void;
}

export function ItemLikeButton({
  itemId,
  initiallyLiked = false,
  size = 22,
  onLikedChange,
}: ItemLikeButtonProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, shadows } = useTheme();
  const {
    liked,
    saveSheetOpen,
    pendingOptimistic,
    toggleLike,
    closeSaveSheet,
    beginAuthForLike,
  } = useItemLike(itemId, initiallyLiked);

  const label = useMemo(
    () =>
      liked
        ? t('items.likes.unlike', 'Remove from favorites')
        : t('items.likes.like', 'Save to favorites'),
    [liked, t]
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: liked }}
        hitSlop={8}
        onPress={(e) => {
          e?.stopPropagation?.();
          void (async () => {
            const next = await toggleLike();
            onLikedChange?.(next);
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
          name={liked ? 'heart' : 'heart-outline'}
          size={size}
          color={liked ? colors.error.main : colors.text.secondary}
        />
      </Pressable>
      <SaveFavoritesSheet
        visible={saveSheetOpen}
        onDismiss={closeSaveSheet}
        onBeginAuth={beginAuthForLike}
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
