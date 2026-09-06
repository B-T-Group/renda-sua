import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  keyboardAwareScrollProps,
  useKeyboardVerticalOffset,
} from '../../hooks/useKeyboardVerticalOffset';

export type KeyboardAwareScrollViewProps = ScrollViewProps & {
  avoidingViewStyle?: StyleProp<ViewStyle>;
  /** Added to header + safe-area offset on iOS. */
  extraKeyboardOffset?: number;
  /** Set false when a parent already wraps KeyboardAvoidingView. */
  wrapAvoidingView?: boolean;
};

export function KeyboardAwareScrollView({
  children,
  contentContainerStyle,
  style,
  avoidingViewStyle,
  extraKeyboardOffset = 0,
  wrapAvoidingView = true,
  keyboardShouldPersistTaps = keyboardAwareScrollProps.keyboardShouldPersistTaps,
  automaticallyAdjustKeyboardInsets = keyboardAwareScrollProps.automaticallyAdjustKeyboardInsets,
  keyboardDismissMode = keyboardAwareScrollProps.keyboardDismissMode,
  ...rest
}: KeyboardAwareScrollViewProps) {
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = useKeyboardVerticalOffset(extraKeyboardOffset);

  const scroll = (
    <ScrollView
      {...rest}
      style={style}
      contentContainerStyle={[{ paddingBottom: insets.bottom + 24 }, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      keyboardDismissMode={keyboardDismissMode}
    >
      {children}
    </ScrollView>
  );

  if (!wrapAvoidingView) {
    return scroll;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, avoidingViewStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {scroll}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
