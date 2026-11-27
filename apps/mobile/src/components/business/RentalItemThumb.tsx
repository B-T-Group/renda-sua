import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { rentalCategoryIcon } from '../../utils/rentals/rentalCategoryIcon';

export interface RentalItemThumbItem {
  name: string;
  rental_category?: { name?: string | null } | null;
  rental_item_images?: Array<{
    display_url?: string | null;
    thumbnail?: string | null;
    image_url?: string | null;
  }>;
}

export function RentalItemThumb({ item }: { item: RentalItemThumbItem }) {
  const { colors, borderRadius } = useTheme();
  const [failed, setFailed] = useState(false);
  const photo = item.rental_item_images?.[0];
  const uri = photo?.display_url || photo?.thumbnail || photo?.image_url;
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.photo, { borderRadius: borderRadius.icon }]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={[styles.photo, styles.thumb, { backgroundColor: colors.primary.main + '14', borderRadius: borderRadius.icon }]}>
      <MaterialCommunityIcons
        name={rentalCategoryIcon(item.rental_category?.name || item.name)}
        size={28}
        color={colors.primary.main}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: 64,
    height: 64,
    flexShrink: 0,
  },
  thumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
