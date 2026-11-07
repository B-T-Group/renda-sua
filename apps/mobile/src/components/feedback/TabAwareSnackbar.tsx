import { useTabBarGeometry } from '../../navigation/tabBarGeometry';
import {
  BottomOverlaySnackbar,
  type BottomOverlaySnackbarProps,
} from './BottomOverlaySnackbar';

type TabAwareSnackbarProps = Omit<BottomOverlaySnackbarProps, 'bottomGap'> & {
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
