import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ImageStyle } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import { useTheme } from '@/contexts/ThemeContext';
import { useImageFallback } from '@/hooks/useImageFallback';

type Props = {
  uri?: string | null;
  recyclingKey?: string;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  contentFit?: ImageContentFit;
  onLoadSize?: (width: number, height: number) => void;
};

/** Cached image with a neutral placeholder and a short crossfade. */
export function AppImage({
  uri,
  recyclingKey,
  style,
  accessibilityLabel,
  contentFit = 'cover',
  onLoadSize,
}: Props) {
  const { colors } = useTheme();
  const { sourceUri, hasImage, onImageError } = useImageFallback(uri);
  const [loaded, setLoaded] = useState(false);
  const placeholder = { backgroundColor: colors.border };

  if (!hasImage) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={[styles.fill, placeholder, style]}
      />
    );
  }

  return (
    <Image
      source={sourceUri}
      recyclingKey={recyclingKey ?? sourceUri}
      cachePolicy="memory-disk"
      contentFit={contentFit}
      transition={150}
      onError={onImageError}
      onLoad={(event) => {
        setLoaded(true);
        onLoadSize?.(event.source.width, event.source.height);
      }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.fill, !loaded && placeholder, style]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});
