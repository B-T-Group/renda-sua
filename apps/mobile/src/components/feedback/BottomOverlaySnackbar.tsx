import { Platform, type ViewStyle } from 'react-native';
import { Portal, Snackbar, type SnackbarProps } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Keeps snackbars above navigation, dialogs, and scrollable list content. */
export const SNACKBAR_OVERLAY_Z_INDEX = 2147483647;

export type BottomOverlaySnackbarProps = Omit<SnackbarProps, 'wrapperStyle'> & {
  /** Extra offset from the bottom safe area (default 16). */
  bottomGap?: number;
};

/**
 * Snackbar anchored to the bottom of the screen via Portal so it is not clipped
 * or positioned inside nested scroll views (e.g. order list rows on web).
 */
export function BottomOverlaySnackbar({
  bottomGap = 16,
  style,
  ...rest
}: BottomOverlaySnackbarProps) {
  const insets = useSafeAreaInsets();
  const bottom = (insets.bottom || 0) + bottomGap;

  const wrapperStyle: ViewStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed',
          bottom,
          left: 16,
          right: 16,
          zIndex: SNACKBAR_OVERLAY_Z_INDEX,
        } as unknown as ViewStyle)
      : {
          position: 'absolute',
          bottom,
          left: 0,
          right: 0,
          zIndex: SNACKBAR_OVERLAY_Z_INDEX,
          elevation: SNACKBAR_OVERLAY_Z_INDEX,
        };

  return (
    <Portal>
      <Snackbar {...rest} style={style} wrapperStyle={wrapperStyle} />
    </Portal>
  );
}
