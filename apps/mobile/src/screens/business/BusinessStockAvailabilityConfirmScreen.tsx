import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import {
  fetchStockAvailabilityCheck,
  respondStockAvailabilityCheck,
  type StockAvailabilityCheckData,
} from '../../services/inventoryItemsApi';
import { StockAvailabilityConfirmView } from '../../components/stockAvailability/StockAvailabilityConfirmView';
import type { StockAvailabilityUiState } from '../../stores/StockAvailabilityStore';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessStockAvailabilityConfirm'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

/** Stack fallback (notification center). Push taps use the root overlay instead. */
export default function BusinessStockAvailabilityConfirmScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const messageId = route.params.messageId;

  const [uiState, setUiState] = useState<StockAvailabilityUiState>('loading');
  const [data, setData] = useState<StockAvailabilityCheckData | null>(null);
  const [qty, setQty] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setUiState('loading');
    setError(null);
    try {
      const res = await fetchStockAvailabilityCheck(messageId);
      setData(res.data);
      setQty(res.data.currentQuantity);
      setUiState(res.data.status === 'pending' ? 'active' : 'done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error', 'Something went wrong'));
      setUiState('error');
    }
  }, [messageId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (action: 'confirm' | 'unavailable') => {
      if (!data || uiState === 'submitting') return;
      setUiState('submitting');
      setError(null);
      try {
        const body =
          action === 'confirm' && qty !== data.currentQuantity
            ? { action: 'adjust' as const, quantity: qty }
            : { action };
        const res = await respondStockAvailabilityCheck(messageId, body);
        setData(res.data);
        setUiState('done');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t('common.error', 'Something went wrong'));
        setUiState('active');
      }
    },
    [data, messageId, qty, t, uiState]
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <StockAvailabilityConfirmView
        uiState={uiState}
        data={data}
        qty={qty}
        error={error}
        onChangeQty={setQty}
        onConfirm={() => void submit('confirm')}
        onMarkUnavailable={() => void submit('unavailable')}
        onClose={() => navigation.goBack()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
