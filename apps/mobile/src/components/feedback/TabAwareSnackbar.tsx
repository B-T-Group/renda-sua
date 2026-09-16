import type { SnackbarProps } from 'react-native-paper';
import { useTabBarGeometry } from '../../navigation/tabBarGeometry';
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
  const { tabBarOverlayHeight } = useTabBarGeometry();

  return (
    <BottomOverlaySnackbar
      {...rest}
      bottomGap={tabBarOverlayHeight + tabBarGap}
    />
  );
}
