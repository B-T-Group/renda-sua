import React from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { shadows } from '../../theme/shadows';

export interface StickyActionCardProps {
  actionLabel: string;
  onAction: () => void;
  actionIcon?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Small caption on the left of the summary row ("Total", "Due at pickup"). */
  summaryLabel?: string;
  summaryValue?: string;
  /** `place` shows the label and value at one size with `summaryDetail` (an address) underneath. */
  summaryVariant?: 'amount' | 'place';
  summaryDetail?: string | null;
  /** Struck-through previous amount shown before the value. */
  summaryPrevious?: string;
  /** One line of context under the summary (legal copy, blocked reason). */
  note?: string;
  noteTone?: 'default' | 'warning';
  tone?: 'primary' | 'cta' | 'success';
  actionLabelStyle?: TextStyle;
  testID?: string;
  actionTestID?: string;
  summaryValueTestID?: string;
}

/**
 * The screen's one primary action, pinned to the bottom: optional price/summary context above a
 * full-width button. Render it as the last child of the screen's flex column, after a `flex: 1`
 * ScrollView: it takes its own height in the layout, so it never covers scrolling content.
 */
export function StickyActionCard(props: StickyActionCardProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const hasSummary = Boolean(props.summaryLabel || props.summaryValue);
  return (
    <View
      testID={props.testID}
      style={[
        styles.bar,
        shadows.md,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {hasSummary ? <SummaryRow {...props} /> : null}
      {props.note ? <NoteLine note={props.note} tone={props.noteTone} /> : null}
      <ActionButton {...props} />
    </View>
  );
}

function PlaceSummary(props: StickyActionCardProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.place}>
      <Text style={styles.placeLine} numberOfLines={2}>
        <Text style={[styles.placeText, { color: colors.text.secondary }]}>{props.summaryLabel} </Text>
        <Text testID={props.summaryValueTestID} style={[styles.placeText, styles.placeName, { color: colors.text.primary }]}>
          {props.summaryValue}
        </Text>
      </Text>
      {props.summaryDetail ? (
        <Text testID="sticky-summary-address" style={[styles.placeText, styles.placeAddress, { color: colors.text.primary }]} numberOfLines={3}>
          {props.summaryDetail}
        </Text>
      ) : null}
    </View>
  );
}

function SummaryRow(props: StickyActionCardProps) {
  const { colors } = useTheme();
  if (props.summaryVariant === 'place') return <PlaceSummary {...props} />;
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.text.secondary }]} numberOfLines={1}>
        {props.summaryLabel}
      </Text>
      <View style={styles.amounts}>
        {props.summaryPrevious ? (
          <Text style={[styles.previous, { color: colors.text.secondary }]}>{props.summaryPrevious}</Text>
        ) : null}
        <Text testID={props.summaryValueTestID} style={[styles.summaryValue, { color: colors.primary.main }]}>
          {props.summaryValue}
        </Text>
      </View>
    </View>
  );
}

function NoteLine({ note, tone }: { note: string; tone?: 'default' | 'warning' }) {
  const { colors } = useTheme();
  const warning = tone === 'warning';
  return (
    <Text
      style={[
        styles.note,
        { color: warning ? colors.warning.dark ?? colors.warning.main : colors.text.secondary, fontWeight: warning ? '600' : '400' },
      ]}
    >
      {note}
    </Text>
  );
}

function ActionButton(props: StickyActionCardProps) {
  const { colors } = useTheme();
  const buttonColor =
    props.tone === 'cta' ? colors.cta.main : props.tone === 'success' ? colors.success.main : colors.primary.main;
  return (
    <Button
      mode="contained"
      icon={props.actionIcon}
      buttonColor={props.disabled ? undefined : buttonColor}
      onPress={props.onAction}
      disabled={props.disabled}
      loading={props.loading}
      testID={props.actionTestID}
      contentStyle={styles.actionContent}
      labelStyle={[styles.actionLabel, props.actionLabelStyle]}
      style={styles.action}
      maxFontSizeMultiplier={1.2}
    >
      {props.actionLabel}
    </Button>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  previous: { fontSize: 14, textDecorationLine: 'line-through' },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  place: { gap: 2 },
  placeLine: { flexShrink: 1 },
  placeText: { fontSize: 14, lineHeight: 20 },
  placeName: { fontWeight: '700' },
  placeAddress: { fontWeight: '600' },
  note: { fontSize: 12, lineHeight: 16 },
  action: { borderRadius: 12 },
  actionContent: { height: 48 },
  actionLabel: { fontSize: 15, fontWeight: '700' },
});
