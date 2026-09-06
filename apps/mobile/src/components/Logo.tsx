import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

type LogoVariant = 'full' | 'compact';

type LogoProps = {
  variant?: LogoVariant;
};

/** Native builds need PNG; Expo web can load the SVG asset directly. */
const LOGO_SOURCE = Platform.select({
  web: require('../../assets/rendasua.svg'),
  default: require('../../assets/rendasua-logo.png'),
});

/**
 * Logo Rendasua.
 * `assets/rendasua.svg` is the design source (raster embedded in SVG).
 * iOS/Android use `rendasua.png` (export from the same artwork).
 */
export default function Logo({ variant = 'full' }: LogoProps) {
  const isCompact = variant === 'compact';

  return (
    <View style={[styles.wrapper, isCompact && styles.wrapperCompact]}>
      <Image
        source={LOGO_SOURCE}
        style={[styles.image, isCompact && styles.imageCompact]}
        resizeMode="contain"
        accessibilityLabel="Rendasua"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapperCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 160,
    height: 48,
  },
  imageCompact: {
    width: 120,
    height: 36,
  },
});
