import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { enterFade, useReducedMotion } from '@/theme/motionHooks';
import { AppText } from '../common/AppText';

type Props = {
  title: string;
  children: ReactNode;
};

/** Expandable checkout step. The children stay the existing checkout controls. */
export function GuidedCheckoutCard({ title, children }: Props) {
  const { colors, spacing, borderRadius } = useTheme();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(true);
  return (
    <View
      style={{
        marginBottom: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.card,
        borderWidth: 1,
        borderColor: colors.divider,
        padding: spacing.md,
      }}
    >
      <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={{ minHeight: 44, justifyContent: 'center' }}>
        <AppText role="h3">{title}</AppText>
      </Pressable>
      {open ? <Animated.View entering={reduced ? undefined : enterFade}>{children}</Animated.View> : null}
    </View>
  );
}
