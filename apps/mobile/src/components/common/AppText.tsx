import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type AppTextRole =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bodyLarge'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label'
  | 'price'
  | 'priceLarge'
  | 'nav';

type Props = {
  role?: AppTextRole;
  color?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  accessibilityRole?: 'header' | 'text';
};

/** Role-based text. Hierarchy comes from the type scale before color. */
export function AppText({
  role = 'body',
  color,
  numberOfLines,
  style,
  children,
  accessibilityRole,
}: Props) {
  const { typography, colors } = useTheme();
  const tone = color ?? (role === 'caption' || role === 'label' ? colors.text.muted : colors.text.primary);
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      style={[typography[role], { color: tone }, style]}
    >
      {children}
    </Text>
  );
}
