import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { QuickCommentDef } from '../../utils/ratingQuickComments';

export interface QuickCommentChipsProps {
  comments: QuickCommentDef[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}

function ChipItem({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          borderRadius: borderRadius.chip,
          borderColor: selected ? colors.primary.main : colors.divider,
          backgroundColor: selected ? colors.primaryTint : colors.surface,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
      ]}
    >
      <Text variant="labelLarge" style={{ color: selected ? colors.primary.dark : colors.text.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Wrapping tappable comment pills. Avoid Paper Chip — it clips on iOS. */
export function QuickCommentChips({
  comments,
  selectedIds,
  onToggle,
  disabled = false,
}: QuickCommentChipsProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  if (comments.length === 0) return null;

  return (
    <View style={[styles.wrap, { gap: spacing.xs }]}>
      {comments.map((comment) => (
        <ChipItem
          key={comment.id}
          label={t(comment.labelKey, comment.labelDefault)}
          selected={selectedIds.includes(comment.id)}
          disabled={disabled}
          onPress={() => onToggle(comment.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, alignSelf: 'flex-start' },
});
