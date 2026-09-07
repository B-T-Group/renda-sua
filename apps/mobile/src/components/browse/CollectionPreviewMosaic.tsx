import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

const SLOT_COUNT = 4;

export interface CollectionPreviewMosaicProps {
  imageUrls: string[];
  gap: number;
  tileBorderRadius: number;
  borderColor: string;
  placeholderColor: string;
}

function MosaicTile({
  uri,
  tileBorderRadius,
  borderColor,
  placeholderColor,
}: {
  uri: string | undefined;
  tileBorderRadius: number;
  borderColor: string;
  placeholderColor: string;
}) {
  return (
    <View
      style={[
        styles.tileOuter,
        {
          borderRadius: tileBorderRadius,
          borderColor,
          backgroundColor: placeholderColor,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.tileImage} resizeMode="cover" />
      ) : null}
    </View>
  );
}

export const CollectionPreviewMosaic = memo(function CollectionPreviewMosaic({
  imageUrls,
  gap,
  tileBorderRadius,
  borderColor,
  placeholderColor,
}: CollectionPreviewMosaicProps) {
  const slots = Array.from(
    { length: SLOT_COUNT },
    (_, index) => imageUrls[index]?.trim() || undefined
  );

  const row = (left: number, right: number) => (
    <View style={[styles.row, { gap }]}>
      <MosaicTile
        uri={slots[left]}
        tileBorderRadius={tileBorderRadius}
        borderColor={borderColor}
        placeholderColor={placeholderColor}
      />
      <MosaicTile
        uri={slots[right]}
        tileBorderRadius={tileBorderRadius}
        borderColor={borderColor}
        placeholderColor={placeholderColor}
      />
    </View>
  );

  return (
    <View style={[styles.grid, { gap }]}>
      {row(0, 1)}
      {row(2, 3)}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  tileOuter: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tileImage: {
    ...StyleSheet.absoluteFillObject,
  },
});
