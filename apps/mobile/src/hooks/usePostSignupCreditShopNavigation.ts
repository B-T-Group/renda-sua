import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '@/stores/RootStore';

/** After signup credit reveal, navigate once to the scoped shop target. */
export function usePostSignupCreditShopNavigation(enabled = true) {
  const { auth } = useStore();
  const navigation =
    useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();

  useEffect(() => {
    if (!enabled) return;
    const target = auth.consumePostSignupCreditShop();
    if (!target) return;
    if (target.kind === 'store' && target.businessId) {
      navigation.navigate('StoreDetail', { businessId: target.businessId });
      return;
    }
    if (target.kind === 'partners') {
      navigation.navigate('StoresList', { partnersOnly: true });
      return;
    }
    navigation.navigate('StoresList');
  }, [auth, enabled, navigation]);
}
