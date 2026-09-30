import React, { useMemo, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Searchbar, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CatalogCategoryCard } from '../../components/browse/CatalogCategoryCard';
import { CategoryBrowseEmpty } from '../../components/browse/CategoryBrowseEmpty';
import { MarketSelector } from '../../components/market/MarketSelector';
import { useTheme } from '../../contexts/ThemeContext';
import { useCatalogCategories } from '../../hooks/useCatalogCategories';
import type { CatalogCategoryTile } from '../../services/catalogExperienceApi';

const GRID_GAP = 12;

type CategoryNav = {
  getState: () => { routeNames: string[] };
  navigate: (name: string, params?: object) => void;
};

export default function CategoriesBrowseScreen() {
  const { width } = useWindowDimensions();
  const { spacing, colors } = useTheme();
  const { categories, loading } = useCatalogCategories();
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterCategories(categories, search), [categories, search]);
  const tileWidth = (width - spacing.md * 2 - GRID_GAP) / 2;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <FlatList
        data={visible}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: GRID_GAP }}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        ListHeaderComponent={<CategoriesHeader search={search} onSearch={setSearch} />}
        ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 32 }} /> : <CategoryBrowseEmpty searching={search.trim().length > 0} />}
        renderItem={({ item }) => <CategoryBrowseCard item={item} width={tileWidth} />}
      />
    </SafeAreaView>
  );
}

function CategoriesHeader({ search, onSearch }: { search: string; onSearch: (value: string) => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
      <Text style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
        {t('client.browse.categoriesSubtitle', 'Find a category, then shop its items.')}
      </Text>
      <MarketSelector />
      <Searchbar
        value={search}
        onChangeText={onSearch}
        placeholder={t('client.browse.categoriesSearch', 'Search categories')}
        style={{ marginTop: spacing.sm }}
      />
    </View>
  );
}

function CategoryBrowseCard({ item, width }: { item: CatalogCategoryTile; width: number }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  return (
    <CatalogCategoryCard
      name={item.name}
      imageUrl={item.imageUrl}
      width={width}
      height={width * 1.25}
      countLabel={t('client.browse.categoryItemCount', '{{count}} items', { count: item.listingCount })}
      accessibilityLabel={t('client.browse.categoryTile', 'Browse {{name}}', { name: item.name })}
      onPress={() => openFilteredBrowse(navigation as CategoryNav, item.name)}
    />
  );
}

function openFilteredBrowse(navigation: CategoryNav, name: string) {
  const params = { category: name, categoryRequestId: Date.now() };
  const names = navigation.getState().routeNames;
  if (names.includes('ClientMainTabs')) {
    navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse', params });
    return;
  }
  navigation.navigate('GuestTabs', { screen: 'GuestBrowse', params });
}

function filterCategories(categories: CatalogCategoryTile[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return categories;
  return categories.filter((category) => category.name.toLowerCase().includes(query));
}
