import React, { memo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import type { DiscoverySortMode } from '@/types/inventoryCatalog';

export interface DiscoverySortSheetProps {
  visible: boolean;
  onDismiss: () => void;
  selectedSort: DiscoverySortMode;
  onSelectSort: (sort: DiscoverySortMode) => void;
  /** Browse (no search) shows Recommended; search shows Best match. */
  isSearch: boolean;
}

const BROWSE_MODES: DiscoverySortMode[] = ['recommended', 'popular', 'rating', 'newest'];
const SEARCH_MODES: DiscoverySortMode[] = ['relevance', 'popular', 'rating', 'newest'];

export const DiscoverySortSheet = memo(function DiscoverySortSheet({
  visible,
  onDismiss,
  selectedSort,
  onSelectSort,
  isSearch,
}: DiscoverySortSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const modes = isSearch ? SEARCH_MODES : BROWSE_MODES;

  const handleSelect = (sort: DiscoverySortMode) => {
    onSelectSort(sort);
    onDismiss();
  };

  const getSortLabel = (mode: DiscoverySortMode): string => {
    switch (mode) {
      case 'recommended':
        return t('public.items.discoverySort.recommended', 'Recommended');
      case 'relevance':
        return t('public.items.discoverySort.relevance', 'Best match');
      case 'popular':
        return t('public.items.discoverySort.popular', 'Popular');
      case 'rating':
        return t('public.items.discoverySort.rating', 'Top rated');
      case 'newest':
        return t('public.items.discoverySort.newest', 'Newest');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background.paper,
              borderTopLeftRadius: borderRadius.xl,
              borderTopRightRadius: borderRadius.xl,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.divider }]} />
          <Text
            variant="titleLarge"
            style={[styles.title, typography.titleLarge, { color: colors.text.primary }]}
          >
            {t('public.items.discoverySort.title', 'Sort by')}
          </Text>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {modes.map((mode) => {
              const isSelected = mode === selectedSort;
              return (
                <Pressable
                  key={mode}
                  onPress={() => handleSelect(mode)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: isSelected
                        ? colors.primary.light + '20'
                        : colors.background.paper,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                >
                  <View style={styles.radioOuter}>
                    {isSelected ? (
                      <View
                        style={[styles.radioInner, { backgroundColor: colors.primary.main }]}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      typography.body1,
                      {
                        color: isSelected ? colors.primary.main : colors.text.primary,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}
                  >
                    {getSortLabel(mode)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    minHeight: 52,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'currentColor',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
