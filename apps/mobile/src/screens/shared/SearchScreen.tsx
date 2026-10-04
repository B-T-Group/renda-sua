import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
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
import { loadRecentSearches, rememberSearch } from '@/utils/recentSearches';

export function SearchScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const rootNav = navigation.getParent<NativeStackNavigationProp<ClientRootStackParamList> | undefined>();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const { suggestions, loading: suggesting } = useSearchSuggestions(query);
  const catalog = useInventoryCatalog({ search: submitted, sort: 'relevance', enabled: submitted.length >= 2 });

  useEffect(() => {
    void loadRecentSearches().then(setRecent);
  }, []);

  const submit = useCallback((term: string) => {
    const cleaned = term.trim();
    setQuery(cleaned);
    setSubmitted(cleaned);
    void rememberSearch(cleaned).then(setRecent);
  }, []);

  const openItem = useCallback(
    (inventoryItemId: string) => {
      (rootNav ?? (navigation as unknown as NativeStackNavigationProp<ClientRootStackParamList>)).navigate(
        'InventoryItemDetail',
        { inventoryItemId }
      );
    },
    [navigation, rootNav]
  );

  const showResults = submitted.length >= 2;
  return (
    <View style={{ flex: 1, backgroundColor: colors.appBackground, paddingTop: insets.top }}>
      <View style={{ padding: spacing.md }}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => submit(query)}
          placeholder={t('client.search.placeholder', 'Search products, stores, food')}
          autoFocus
        />
      </View>
      {showResults ? (
        <FlashList
          data={catalog.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
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
                style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: 999, backgroundColor: colors.surfaceInput }}
              >
                <AppText role="label">{term}</AppText>
              </Pressable>
            ))}
          </View>
          {suggesting ? <ListRowSkeleton /> : null}
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestionKey(suggestion)}
              onPress={() => onSuggestion(suggestion, submit, openItem)}
              style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            >
              {suggestion.kind === 'product' ? (
                <AppImage uri={suggestion.imageUrl} recyclingKey={suggestion.inventoryId} style={{ width: 40, height: 40, borderRadius: 8 }} />
              ) : null}
              <AppText role="body">{suggestionLabel(suggestion)}</AppText>
            </Pressable>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function suggestionKey(suggestion: SearchSuggestion): string {
  if (suggestion.kind === 'product') return `p-${suggestion.inventoryId}`;
  if (suggestion.kind === 'seller') return `s-${suggestion.businessId}`;
  return `${suggestion.kind}-${suggestion.value}`;
}

function suggestionLabel(suggestion: SearchSuggestion): string {
  if (suggestion.kind === 'product') return suggestion.title;
  if (suggestion.kind === 'seller') return suggestion.name;
  return suggestion.value;
}

function onSuggestion(suggestion: SearchSuggestion, submit: (term: string) => void, openItem: (id: string) => void) {
  if (suggestion.kind === 'product') {
    openItem(suggestion.inventoryId);
    return;
  }
  if (suggestion.kind === 'seller') {
    submit(suggestion.name);
    return;
  }
  submit(suggestion.value);
}

export default SearchScreen;
