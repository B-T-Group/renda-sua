import React, { type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  visible: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function RecoverySheet({ visible, title, children, footer, onClose }: Props) {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            shadows.lg,
            {
              backgroundColor: colors.background.paper,
              borderRadius: borderRadius.xl,
              maxHeight: height * 0.85,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text variant="titleMedium" style={{ padding: spacing.md }}>
            {title}
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ padding: spacing.md }}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
  },
});
