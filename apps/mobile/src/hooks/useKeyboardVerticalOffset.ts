import { Platform } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Default ScrollView props that keep focused inputs visible when the keyboard opens. */
export const keyboardAwareScrollProps = {
  keyboardShouldPersistTaps: 'handled' as const,
  automaticallyAdjustKeyboardInsets: true,
  keyboardDismissMode: 'on-drag' as const,
};

/**
 * Offset for KeyboardAvoidingView — stack header + top safe area + optional extras
 * (floating dev menu, tab bar overlap, etc.).
 */
export function useKeyboardVerticalOffset(extra = 0): number {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  if (Platform.OS === 'ios') {
    return headerHeight + insets.top + extra;
  }
  return extra;
}
