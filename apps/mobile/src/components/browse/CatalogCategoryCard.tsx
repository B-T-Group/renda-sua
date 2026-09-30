import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export function CatalogCategoryCard({
  name,
  imageUrl,
  countLabel,
  width,
  height,
  onPress,
  accessibilityLabel,
}: {
  name: string;
  imageUrl: string | null;
  countLabel?: string;
  width: number;
  height: number;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors, borderRadius, shadows } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.tile,
        shadows.sm,
        { width, height, borderRadius: borderRadius.card, backgroundColor: colors.background.paper },
      ]}
    >
      <CategoryArt name={name} imageUrl={imageUrl} color={colors.primary.main} text={colors.primary.contrast} />
      <CategoryCaption name={name} countLabel={countLabel} />
    </Pressable>
  );
}

function CategoryCaption({ name, countLabel }: { name: string; countLabel?: string }) {
  return (
    <View style={styles.overlay}>
      <Text numberOfLines={2} style={styles.label}>
        {name}
      </Text>
      {countLabel ? <Text style={styles.count}>{countLabel}</Text> : null}
    </View>
  );
}

function CategoryArt({
  name,
  imageUrl,
  color,
  text,
}: {
  name: string;
  imageUrl: string | null;
  color: string;
  text: string;
}) {
  if (imageUrl) return <Image source={{ uri: imageUrl }} style={styles.art} resizeMode="cover" />;
  return (
    <View style={[styles.art, styles.fallback, { backgroundColor: color }]}>
      <Text style={{ color: text, fontSize: 28, fontWeight: '700' }}>
        {name.trim().slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden' },
  art: { ...StyleSheet.absoluteFillObject },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingTop: 28,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  label: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  count: { color: 'rgba(255,255,255,0.88)', textAlign: 'center', marginTop: 2, fontSize: 12 },
});
