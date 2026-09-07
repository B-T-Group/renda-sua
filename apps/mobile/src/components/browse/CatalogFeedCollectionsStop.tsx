import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { CollectionSummary } from '../../types/collections';
import { CatalogCollectionsRow } from './CatalogCollectionsRow';

export interface CatalogFeedCollectionsStopProps {
  collections: CollectionSummary[];
  onCollectionPress?: (slug: string) => void;
}

/**
 * "Browse essentials" / Collections mid-feed stop.
 * Reuses the existing CatalogCollectionsRow with a header icon.
 */
export const CatalogFeedCollectionsStop = memo(function CatalogFeedCollectionsStop({
  collections,
  onCollectionPress,
}: CatalogFeedCollectionsStopProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const theme = useTheme();

  if (collections.length === 0) return null;

  return (
    <View>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.md, marginBottom: spacing.xs }]}>
        <View style={styles.titleRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.secondary.main + '15' }]}>
            <MaterialCommunityIcons
              name="folder-multiple-outline"
              size={18}
              color={colors.secondary.main}
            />
          </View>
          <Text
            variant="labelLarge"
            style={{ color: colors.text.secondary, fontWeight: '700', marginLeft: 6 }}
          >
            {t('catalog.collections.title', 'Browse essentials')}
          </Text>
        </View>
      </View>
      <CatalogCollectionsRow
        theme={theme}
        collections={collections}
        loading={false}
        onCollectionPress={onCollectionPress ?? (() => {})}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
