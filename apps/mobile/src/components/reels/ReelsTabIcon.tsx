import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const reelsTabIcon = require('../../../assets/icons/reels-tab-brand.png');

type Props = {
  color: string;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Leaping Rendasua cat + play mark for the Reels tab (tints with tab color). */
export function ReelsTabIcon({ color, size = 30, style }: Props) {
  return (
    <Image
      source={reelsTabIcon}
      style={[{ width: size, height: size, tintColor: color }, style]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
