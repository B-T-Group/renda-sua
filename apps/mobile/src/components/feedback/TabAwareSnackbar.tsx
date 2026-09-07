import type { SnackbarProps } from 'react-native-paper';
import { useTabBarOverlayHeight } from '../../hooks/useMainTabContentBottomPadding';
import { BottomOverlaySnackbar } from './BottomOverlaySnackbar';

type TabAwareSnackbarProps = Omit<SnackbarProps, 'wrapperStyle'> & {
  /** Extra gap above the tab bar (default 12). */
  tabBarGap?: number;
};

/** Snackbar positioned above the bottom tab bar on tab-root screens. */
export function TabAwareSnackbar({
  tabBarGap = 12,
  ...rest
}: TabAwareSnackbarProps) {
  const tabBarOffset = useTabBarOverlayHeight();

  return <BottomOverlaySnackbar {...rest} bottomGap={tabBarOffset + tabBarGap} />;
}
