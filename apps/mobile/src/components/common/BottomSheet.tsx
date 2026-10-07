import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { AppText } from './AppText';
import { useLauncherSuppressor } from '../assistant/launcher/useLauncherSuppressor';
import { sheetVisibilityCommand } from './sheetVisibility';

export { BottomSheetTextInput } from '@gorhom/bottom-sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  snapPoints?: (string | number)[];
  footer?: ReactNode;
  /** Stays open. Used for the active-delivery sheet over the route. */
  persistent?: boolean;
  /** Lifts the sheet so a sticky footer behind it stays tappable. */
  bottomInset?: number;
  /** Render children directly so a sheet list can own the scroll gesture. */
  unwrapped?: boolean;
};

function useSheetVisibility(
  ref: RefObject<BottomSheetModal | null>,
  visible: boolean,
  closedBySheet: RefObject<boolean>
) {
  const hasOpened = useRef(false);
  useEffect(() => {
    const command = sheetVisibilityCommand(
      visible,
      hasOpened.current,
      closedBySheet.current
    );
    if (visible) {
      hasOpened.current = true;
      closedBySheet.current = false;
    } else if (closedBySheet.current) {
      closedBySheet.current = false;
    }
    if (command === 'present') ref.current?.present();
    else if (command === 'dismiss') ref.current?.dismiss();
  }, [closedBySheet, ref, visible]);
}

function PersistentBackdrop() {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} />;
}

function DismissBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
    />
  );
}

function useSheetBackdrop(persistent: boolean) {
  return useCallback(
    (props: BottomSheetBackdropProps) =>
      persistent ? <PersistentBackdrop /> : <DismissBackdrop {...props} />,
    [persistent]
  );
}

function usePersistentDismiss(
  ref: RefObject<BottomSheetModal | null>,
  visible: boolean,
  persistent: boolean,
  onClose: () => void,
  closedBySheet: RefObject<boolean>
) {
  const visibleRef = useRef(visible);
  const alive = useRef(true);
  visibleRef.current = visible;
  useEffect(() => () => {
    alive.current = false;
  }, []);
  return useCallback(() => {
    if (!persistent) {
      closedBySheet.current = true;
      onClose();
      return;
    }
    if (!visibleRef.current || !alive.current) return;
    requestAnimationFrame(() => ref.current?.present());
  }, [closedBySheet, onClose, persistent, ref]);
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
      style={styles.close}
    >
      <MaterialCommunityIcons name="close" size={20} color={colors.text.secondary} />
    </Pressable>
  );
}

function SheetTitle({ title, onClose }: { title?: string; onClose: () => void }) {
  return (
    <View style={styles.titleRow}>
      {title ? (
        <AppText role="h3" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
      ) : (
        <View style={styles.title} />
      )}
      <CloseButton onClose={onClose} />
    </View>
  );
}

/** Native sheet. Drag, scrim, and the close control all dismiss. */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  snapPoints,
  footer,
  persistent = false,
  bottomInset = 0,
  unwrapped = false,
}: Props) {
  const ref = useRef<BottomSheetModal>(null);
  const closedBySheet = useRef(false);
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius } = useTheme();
  const renderBackdrop = useSheetBackdrop(persistent);
  const onDismiss = usePersistentDismiss(
    ref,
    visible,
    persistent,
    onClose,
    closedBySheet
  );
  useSheetVisibility(ref, visible, closedBySheet);
  useLauncherSuppressor(visible);
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>{footer}</View>
      </BottomSheetFooter>
    ),
    [footer, insets.bottom, spacing.md, spacing.sm]
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onDismiss}
      bottomInset={bottomInset}
      enableDynamicSizing={!persistent && !snapPoints?.length && !unwrapped}
      snapPoints={snapPoints}
      enablePanDownToClose={!persistent}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      footerComponent={footer ? renderFooter : undefined}
      backgroundStyle={{
        backgroundColor: colors.surfaceModal,
        borderTopLeftRadius: borderRadius.card,
        borderTopRightRadius: borderRadius.card,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
    >
      {unwrapped ? (
        children
      ) : persistent || snapPoints?.length ? (
        <BottomSheetScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          }}
          showsVerticalScrollIndicator={false}
        >
          {persistent ? (
            title ? (
              <AppText role="h3" accessibilityRole="header" style={styles.title}>
                {title}
              </AppText>
            ) : null
          ) : (
            <SheetTitle title={title} onClose={onClose} />
          )}
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          }}
        >
          <SheetTitle title={title} onClose={onClose} />
          {children}
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
