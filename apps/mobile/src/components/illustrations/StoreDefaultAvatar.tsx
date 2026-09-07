import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  storeAvatarPalette,
  storeMonogram,
} from '../../utils/storeAvatarPalette';

type Props = {
  name: string;
  size?: number;
};

/** Illustrated default store mark when no logo is uploaded. */
export const StoreDefaultAvatar = memo(function StoreDefaultAvatar({
  name,
  size = 64,
}: Props) {
  const palette = storeAvatarPalette(name);
  const letter = storeMonogram(name);
  const fontSize = size >= 64 ? Math.round(size * 0.28) : Math.round(size * 0.34);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          backgroundColor: palette.bgSoft,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={`${name} store avatar`}
    >
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Circle cx="40" cy="40" r="36" fill={palette.bg} opacity={0.12} />
        <Rect
          x="18"
          y="34"
          width="44"
          height="28"
          rx="4"
          fill={palette.bg}
          opacity={0.92}
        />
        <Path d="M18 38 L40 22 L62 38" fill={palette.accent} />
        <Rect
          x="34"
          y="44"
          width="12"
          height="18"
          rx="2"
          fill={palette.accentSoft}
        />
        <Circle cx="28" cy="48" r="3" fill={palette.accentSoft} />
        <Circle cx="52" cy="48" r="3" fill={palette.accentSoft} />
      </Svg>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: palette.bg,
            minWidth: size * 0.42,
            height: size * 0.42,
            borderRadius: size * 0.21,
            bottom: size * 0.06,
            right: size * 0.06,
          },
        ]}
      >
        <Text
          style={{
            color: palette.monogram,
            fontWeight: '800',
            fontSize,
            lineHeight: fontSize * 1.1,
          }}
        >
          {letter}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
