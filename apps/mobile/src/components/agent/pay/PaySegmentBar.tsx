import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import type { PaySegment } from '../../../types/agentPayBoard';

const SEGMENTS: Array<{ id: PaySegment; labelKey: string; fallback: string }> = [
  { id: 'commissions', labelKey: 'agent.pay.segments.commissions', fallback: 'Commissions' },
  { id: 'deliveries', labelKey: 'agent.pay.segments.deliveries', fallback: 'Deliveries' },
  { id: 'objectives', labelKey: 'agent.pay.segments.objectives', fallback: 'Objectives' },
  { id: 'wallet', labelKey: 'agent.pay.segments.wallet', fallback: 'Wallet' },
];

const GAP = 4;
const PAD = 4;

export function PaySegmentBar({
  value,
  onChange,
}: {
  value: PaySegment;
  onChange: (segment: PaySegment) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<PaySegment, number>>>({});
  const widths = useRef<Partial<Record<PaySegment, number>>>({});
  const [viewWidth, setViewWidth] = useState(0);
  const [natural, setNatural] = useState(0);
  const spread = natural > 0 && viewWidth > 0 && natural <= viewWidth;
  const reveal = useReveal(scrollRef, offsets);

  useEffect(() => {
    reveal(value);
  }, [reveal, value]);

  const noteWidth = useCallback((id: PaySegment, width: number) => {
    widths.current[id] = width;
    setNatural(rowWidth(widths.current));
  }, []);

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
        },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setViewWidth(event.nativeEvent.layout.width)}
        contentContainerStyle={styles.scroll}
      >
        <View style={[styles.row, spread ? styles.spread : null]}>
          {SEGMENTS.map((segment) => (
            <SegmentTab
              key={segment.id}
              label={t(segment.labelKey, segment.fallback)}
              selected={segment.id === value}
              radius={borderRadius.md}
              onPress={() => onChange(segment.id)}
              onLayout={(x, width) => {
                offsets.current[segment.id] = x;
                noteWidth(segment.id, width);
                if (segment.id === value) reveal(segment.id);
              }}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function rowWidth(widths: Partial<Record<PaySegment, number>>) {
  if (SEGMENTS.some((segment) => widths[segment.id] == null)) return 0;
  const labels = SEGMENTS.reduce((total, segment) => total + (widths[segment.id] ?? 0), 0);
  return labels + GAP * (SEGMENTS.length - 1) + PAD * 2;
}

function useReveal(
  scrollRef: RefObject<ScrollView | null>,
  offsets: RefObject<Partial<Record<PaySegment, number>>>
) {
  return useCallback(
    (id: PaySegment) => {
      const x = offsets.current?.[id];
      if (x == null) return;
      scrollRef.current?.scrollTo({ x: Math.max(0, x - 8), animated: true });
    },
    [offsets, scrollRef]
  );
}

function SegmentTab({
  label,
  selected,
  radius,
  onPress,
  onLayout,
}: {
  label: string;
  selected: boolean;
  radius: number;
  onPress: () => void;
  onLayout: (x: number, width: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={(event) => onLayout(event.nativeEvent.layout.x, event.nativeEvent.layout.width)}
      style={[
        styles.item,
        {
          backgroundColor: selected ? colors.primary.main : 'transparent',
          borderRadius: radius,
        },
      ]}
    >
      <Text variant="labelLarge" style={{ color: selected ? colors.primary.contrast : colors.text.secondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP, padding: PAD },
  spread: { flexGrow: 1, justifyContent: 'space-evenly' },
  item: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
});
