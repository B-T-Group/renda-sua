import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SectionCard } from '../../common/SectionCard';
import { spacing } from '@/theme/spacing';

type Props = {
  title: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Form section container for Business item forms.
 * Delegates all visual chrome to the shared SectionCard so spacing,
 * radius, shadow, and background stay consistent with the design system.
 */
export function ItemFormSection({ title, children, style, contentStyle }: Props) {
  return (
    <SectionCard
      title={title}
      style={[styles.section, style]}
      contentStyle={contentStyle}
    >
      {children}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
});

