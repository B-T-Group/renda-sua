import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchInput } from '@/components/common/SearchInput';
import { AppText } from '@/components/common/AppText';
import { AppImage } from '@/components/common/AppImage';
import { enterFade } from '@/theme/motionHooks';
import { EmptyState } from '@/components/common/EmptyState';
import { ListRowSkeleton } from '@/components/common/skeletons';
import { InventoryCatalogGridTile } from '@/components/browse/InventoryCatalogGridTile';
import { useTheme } from '@/contexts/ThemeContext';
import { useInventoryCatalog } from '@/hooks/useInventoryCatalog';
import { useSearchSuggestions, type SearchSuggestion } from '@/hooks/useSearchSuggestions';
import type { ClientRootStackParamList } from '@/navigation/types';
import type { CatalogStore } from '@/types/stores';
import { loadRecentSearches, rememberSearch } from '@/utils/recentSearches';

export function SearchScreen({
  showBack = false,
  foodOnly = false,
  onBack,
}: {
  showBack?: boolean;
  /** Food lane opens search already limited to cooked food. */
  foodOnly?: boolean;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const rootNav = navigation.getParent<NativeStackNavigationProp<ClientRootStackParamList> | undefined>();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const { suggestions, loading: suggesting } = useSearchSuggestions(query);
  const catalog = useInventoryCatalog({
    search: submitted,
    sort: 'relevance',
    food_only: foodOnly || undefined,
    enabled: submitted.length >= 2,
  });

  useEffect(() => {
    void loadRecentSearches().then(setRecent);
  }, []);

  const submit = useCallback((term: string) => {
    const cleaned = term.trim();
    setQuery(cleaned);
    setSubmitted(cleaned);
    void rememberSearch(cleaned).then(setRecent);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setSubmitted('');
  }, []);

  const navigateRoot = useCallback(() => {
    return rootNav ?? (navigation as unknown as NativeStackNavigationProp<ClientRootStackParamList>);
  }, [navigation, rootNav]);

  const openItem = useCallback(
    (inventoryItemId: string) => {
      navigateRoot().navigate('InventoryItemDetail', { inventoryItemId });
    },
    [navigateRoot]
  );

  const openStore = useCallback(
    (businessId: string) => {
      navigateRoot().navigate('StoreDetail', { businessId });
    },
    [navigateRoot]
  );

  const showResults = submitted.length >= 2;
  return (
    <View style={{ flex: 1, backgroundColor: colors.appBackground, paddingTop: insets.top }}>
      <View style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', 'Back')}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => submit(query)}
          onClear={clearSearch}
          placeholder={t('client.search.placeholder', 'Search products, stores, food')}
          autoFocus
        />
        </View>
      </View>
      {showResults ? (
        <FlashList
          data={catalog.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={
            catalog.matchedStores.length > 0 ? (
              <MatchedStoresHeader
                stores={catalog.matchedStores}
                onOpenStore={openStore}
                title={t('client.search.matchingStores', 'Matching stores')}
              />
            ) : null
          }
          ListEmptyComponent={
            catalog.loading ? (
              <ListRowSkeleton />
            ) : (
              <EmptyState
                title={t('client.search.emptyTitle', 'No matches')}
                body={t('client.search.emptyBody', 'Try a product, a store, or a category.')}
              />
            )
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1, padding: spacing.xs }}>
              <InventoryCatalogGridTile item={item} onPress={openItem} />
            </View>
          )}
        />
      ) : (
        <Animated.View entering={enterFade} style={{ paddingHorizontal: spacing.md }}>
          {recent.length > 0 ? (
            <AppText role="label" style={{ marginBottom: spacing.sm }}>
              {t('client.search.recent', 'Recent searches')}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
            {recent.map((term) => (
              <Pressable
                key={term}
                onPress={() => submit(term)}
                style={{
                  minHeight: 36,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.sm,
                  borderRadius: 999,
                  backgroundColor: colors.surfaceInput,
                }}
              >
                <AppText role="label">{term}</AppText>
              </Pressable>
            ))}
          </View>
          {suggesting ? <ListRowSkeleton /> : null}
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestionKey(suggestion)}
              onPress={() => onSuggestion(suggestion, submit, openItem, openStore)}
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              {suggestion.kind === 'product' ? (
                <AppImage
                  uri={suggestion.imageUrl}
                  recyclingKey={suggestion.inventoryId}
                  style={{ width: 40, height: 40, borderRadius: borderRadius.sm }}
                />
              ) : null}
              <AppText role="body">{suggestionLabel(suggestion)}</AppText>
            </Pressable>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function MatchedStoresHeader({
  stores,
  onOpenStore,
  title,
}: {
  stores: CatalogStore[];
  onOpenStore: (businessId: string) => void;
  title: string;
}) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
      <AppText role="label" style={{ marginBottom: spacing.sm }}>
        {title}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {stores.map((store) => (
            <Pressable
              key={store.business_location_id}
              onPress={() => onOpenStore(store.business_location_id)}
              style={{
                width: 140,
                padding: spacing.sm,
                borderRadius: borderRadius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.divider,
              }}
            >
              {store.logo_url ? (
                <AppImage
                  uri={store.logo_url}
                  recyclingKey={store.business_location_id}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.sm,
                    marginBottom: spacing.xs,
                  }}
                />
              ) : null}
              <AppText role="label" numberOfLines={1}>
                {store.name}
              </AppText>
              {store.city ? (
                <AppText role="caption" numberOfLines={1}>
                  {store.city}
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function suggestionKey(suggestion: SearchSuggestion): string {
  if (suggestion.kind === 'product') return `p-${suggestion.inventoryId}`;
  if (suggestion.kind === 'seller') {
    return `s-${suggestion.businessLocationId ?? suggestion.businessId}`;
  }
  return `${suggestion.kind}-${suggestion.value}`;
}

function suggestionLabel(suggestion: SearchSuggestion): string {
  if (suggestion.kind === 'product') return suggestion.title;
  if (suggestion.kind === 'seller') return suggestion.name;
  return suggestion.value;
}

function onSuggestion(
  suggestion: SearchSuggestion,
  submit: (term: string) => void,
  openItem: (id: string) => void,
  openStore: (businessId: string) => void
) {
  if (suggestion.kind === 'product') {
    openItem(suggestion.inventoryId);
    return;
  }
  if (suggestion.kind === 'seller') {
    openStore(suggestion.businessLocationId ?? suggestion.businessId);
    return;
  }
  submit(suggestion.value);
}

export default SearchScreen;
