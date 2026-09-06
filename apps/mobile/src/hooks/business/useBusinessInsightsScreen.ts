import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { useDashboardAggregates } from './useDashboardAggregates';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export function useBusinessInsightsScreen() {
  const navigation = useNavigation<Nav>();
  const { data, loading, error, refresh } = useDashboardAggregates();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh({ silent: true });
    }, [refresh])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const onOpenClientCities = useCallback(() => {
    navigation.navigate('BusinessClientCities');
  }, [navigation]);

  const onOpenTopViewedProduct = useCallback(
    (product: { itemId: string }) => {
      if (!product.itemId) return;
      navigation.navigate('BusinessItemDetail', { itemId: product.itemId });
    },
    [navigation]
  );

  return {
    loading,
    refreshing,
    error,
    uniqueClientCount: error ? null : (data?.uniqueClientCount ?? null),
    totalProductViews: error ? null : (data?.totalProductViews ?? null),
    productViewsLast7d: error ? null : (data?.productViewsLast7d ?? null),
    topViewedProducts: error ? [] : (data?.topViewedProducts ?? []),
    onOpenClientCities,
    onOpenTopViewedProduct,
    onRefresh,
    retry: refresh,
  };
}
