import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import type { PaySegment } from '../../../types/agentPayBoard';

const SEGMENTS: Array<{ id: PaySegment; labelKey: string; fallback: string }> = [
  { id: 'commissions', labelKey: 'agent.pay.segments.commissions', fallback: 'Commissions' },
  { id: 'objectives', labelKey: 'agent.pay.segments.objectives', fallback: 'Objectives' },
  { id: 'wallet', labelKey: 'agent.pay.segments.wallet', fallback: 'Wallet' },
];

export function PaySegmentBar({
  value,
  onChange,
}: {
  value: PaySegment;
  onChange: (segment: PaySegment) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
          padding: 4,
        },
      ]}
    >
      {SEGMENTS.map((segment) => {
        const selected = segment.id === value;
        const label = t(segment.labelKey, segment.fallback);
        return (
          <Pressable
            key={segment.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => onChange(segment.id)}
            style={[
              styles.item,
              {
                backgroundColor: selected ? colors.primary.main : 'transparent',
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Text
              variant="labelLarge"
              numberOfLines={1}
              style={{ color: selected ? colors.primary.contrast : colors.text.secondary }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, paddingHorizontal: 4 },
});
