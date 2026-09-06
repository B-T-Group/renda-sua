import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';

export type EntityActionMode = 'contained' | 'outlined' | 'text' | 'contained-tonal';

export interface EntityActionDefinition {
  id: string;
  label: string;
  icon?: string;
  mode?: EntityActionMode;
  destructive?: boolean;
  primary?: boolean;
  compact?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export interface EntityActionRowProps {
  actions: EntityActionDefinition[];
  onActionPress: (actionId: string) => void;
  layout?: 'row-wrap' | 'column';
}

/** Shared inline action buttons for orders, items, rentals, and agent deliveries. */
export function EntityActionRow({
  actions,
  onActionPress,
  layout = 'row-wrap',
}: EntityActionRowProps) {
  const { colors, spacing } = useTheme();

  if (actions.length === 0) return null;

  return (
    <View
      style={[
        layout === 'column' ? styles.column : styles.rowWrap,
        { gap: spacing.sm, marginTop: spacing.md },
      ]}
    >
      {actions.map((action) => {
        const mode: EntityActionMode =
          action.mode ??
          (action.destructive ? 'outlined' : action.primary ? 'contained' : 'contained-tonal');

        return (
          <Button
            key={action.id}
            mode={mode}
            icon={action.icon}
            compact={action.compact ?? true}
            loading={action.loading}
            disabled={action.disabled || action.loading}
            textColor={action.destructive ? colors.error.main : undefined}
            buttonColor={
              action.destructive && mode === 'contained' ? colors.error.main : undefined
            }
            onPress={() => onActionPress(action.id)}
            style={layout === 'column' ? styles.fullWidth : undefined}
          >
            {action.label}
          </Button>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  column: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
