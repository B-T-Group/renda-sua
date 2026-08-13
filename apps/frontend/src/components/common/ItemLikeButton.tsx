import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import { IconButton, keyframes, Tooltip } from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useItemLike } from '../../hooks/useItemLike';
import SaveFavoritesDrawer from '../dialogs/SaveFavoritesDrawer';

const pulse = keyframes`
  0% { transform: scale(1); }
  40% { transform: scale(1.25); }
  100% { transform: scale(1); }
`;

export interface ItemLikeButtonProps {
  itemId: string | null | undefined;
  initiallyLiked?: boolean;
  size?: 'small' | 'medium';
  /** When true, use white/contrast colors for overlay on images. */
  overlay?: boolean;
  onLikedChange?: (liked: boolean) => void;
}

const ItemLikeButton: React.FC<ItemLikeButtonProps> = ({
  itemId,
  initiallyLiked = false,
  size = 'small',
  overlay = false,
  onLikedChange,
}) => {
  const { t } = useTranslation();
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
      <Tooltip title={label}>
        <IconButton
          size={size}
          aria-label={label}
          aria-pressed={liked}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void (async () => {
              const next = await toggleLike();
              onLikedChange?.(next);
            })();
          }}
          sx={{
            bgcolor: overlay ? 'rgba(255,255,255,0.92)' : 'background.paper',
            boxShadow: overlay ? 1 : 0,
            color: liked ? 'error.main' : 'text.secondary',
            animation:
              pendingOptimistic || liked
                ? `${pulse} 0.35s ease-out`
                : undefined,
            '&:hover': {
              bgcolor: overlay ? 'rgba(255,255,255,1)' : 'action.hover',
              color: 'error.main',
            },
          }}
        >
          {liked ? (
            <Favorite fontSize={size === 'small' ? 'small' : 'medium'} />
          ) : (
            <FavoriteBorder fontSize={size === 'small' ? 'small' : 'medium'} />
          )}
        </IconButton>
      </Tooltip>
      <SaveFavoritesDrawer
        open={saveSheetOpen}
        onClose={closeSaveSheet}
        onBeginAuth={beginAuthForLike}
      />
    </>
  );
};

export default ItemLikeButton;
