import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ListRow } from '@/components/common/ListRow';
import { ListRowSkeleton } from '@/components/common/skeletons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ClientRootStackParamList } from '@/navigation/types';
import { fetchBusinessFollows, type FollowedBusiness } from '@/services/businessFollowsApi';
import { toFriendlyError } from '@/utils/toFriendlyError';

export function FollowingStoresScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const [rows, setRows] = useState<FollowedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchBusinessFollows(1, 50);
      setRows(page.businesses.filter((row) => row.following));
    } catch (err: unknown) {
      setError(toFriendlyError(err, t('client.following.error', 'Something went wrong while loading stores you follow.')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.appBackground }}>
        <ListRowSkeleton />
        <ListRowSkeleton />
      </View>
    );
  }
  if (error) {
    return (
      <ErrorState
        title={error}
        actionLabel={t('common.tryAgain', 'Try again')}
        onRetry={() => void load()}
      />
    );
  }
  return (
    <FlatList
      style={{ backgroundColor: colors.appBackground }}
      data={rows}
      keyExtractor={(row) => row.id}
      ListEmptyComponent={
        <EmptyState
          title={t('client.following.emptyTitle', 'No stores yet')}
          body={t('client.following.emptyBody', 'Follow a store to find it again here.')}
          actionLabel={t('client.following.browse', 'Browse stores')}
          onAction={() => navigation.navigate('StoresList')}
        />
      }
      renderItem={({ item }) => (
        <ListRow
          title={item.name}
          subtitle={t('client.following.followers', '{{count}} followers', { count: item.followers_count })}
          onPress={() => navigation.navigate('StoreDetail', { businessId: item.id })}
        />
      )}
    />
  );
}

export default FollowingStoresScreen;
