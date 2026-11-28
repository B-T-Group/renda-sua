import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type HomeLaneIconKey = 'rentals' | 'exports' | 'shop' | 'food';

/** One glyph per browse lane; shared by the lane switcher and the market picker counts. */
export const LANE_ICONS: Record<HomeLaneIconKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  rentals: 'hand-coin',
  exports: 'airplane',
  shop: 'shopping',
  food: 'food',
};
