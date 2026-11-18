import { useEffect } from 'react';
import { sceneName } from './fixtures';

const ITEM = new Set(['edit', 'explainer', 'explainer-momo', 'baseline']);

export function useRoute() {
  const scene = sceneName();
  if (ITEM.has(scene)) return { key: 'item', name: 'BusinessRentalItemEdit', params: { itemId: 'item-1' } };
  if (scene === 'review') return { key: 'client', name: 'ClientInspection', params: { bookingId: 'b1', stage: 'pickup' } };
  return { key: 'business', name: 'BusinessInspection', params: { bookingId: 'b1', stage: 'pickup' } };
}

export function useNavigation() {
  return {
    navigate: () => undefined,
    goBack: () => undefined,
    setOptions: () => undefined,
    addListener: () => () => undefined,
    canGoBack: () => false,
  };
}

export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(() => effect(), []);
}

export function useIsFocused() {
  return true;
}
