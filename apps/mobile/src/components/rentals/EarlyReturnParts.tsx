import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

/** Shared pieces of the early-return screens (mock 01–05b). Brand blue, no purple. */
export const EARLY_BLUE = '#0A4FB5';
export const EARLY_GREEN = '#0B7A3B';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface IconAction {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
  testID?: string;
}

/** Round icon actions with the label under them: Directions · Message · ↶ Return early. */
export function IconActionRow({ actions }: { actions: IconAction[] }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.actionRow}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          testID={action.testID}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={styles.action}
        >
          <View
            style={[
              styles.actionCircle,
              action.primary
                ? { backgroundColor: EARLY_BLUE }
                : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
            ]}
          >
            <MaterialCommunityIcons name={action.icon} size={24} color={action.primary ? '#FFFFFF' : colors.text.primary} />
          </View>
          <Text
            style={[
              typography.caption,
              { marginTop: 6, fontWeight: '600', color: action.primary ? EARLY_BLUE : colors.text.secondary, textAlign: 'center' },
            ]}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export interface SummaryLine {
  key: string;
  icon: IconName;
  label: string;
  value?: string;
  sub?: string;
  chips?: string[];
  onEdit?: () => void;
  editLabel?: string;
}

/** The bordered summary table in the confirm sheets (Booked / Returning now / You pay / Deposit). */
export function SummaryTable({ lines, testID }: { lines: SummaryLine[]; testID?: string }) {
  const { colors, typography, borderRadius } = useTheme();
  return (
    <View testID={testID} style={[styles.table, { borderColor: colors.divider, borderRadius: borderRadius.md }]}>
      {lines.map((line, index) => (
        <View
          key={line.key}
          style={[styles.tableRow, index > 0 ? { borderTopWidth: 1, borderTopColor: colors.divider } : null]}
        >
          <MaterialCommunityIcons name={line.icon} size={20} color={colors.text.secondary} />
          <Text style={[typography.body2, { color: colors.text.secondary, marginLeft: 10, flex: 1 }]}>{line.label}</Text>
          {line.chips?.length ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {line.chips.map((chip) => (
                <Text
                  key={chip}
                  style={[
                    typography.caption,
                    styles.chip,
                    { backgroundColor: colors.divider, color: colors.text.secondary },
                  ]}
                >
                  {chip}
                </Text>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
              <Text style={[typography.body2, { color: colors.text.primary, fontWeight: '700' }]}>{line.value}</Text>
              {line.sub ? <Text style={[typography.caption, { color: colors.text.secondary }]}>{line.sub}</Text> : null}
            </View>
          )}
          {line.onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={line.editLabel}
              onPress={line.onEdit}
              hitSlop={12}
              style={{ marginLeft: 10 }}
              testID="early-return-edit-time"
            >
              <MaterialCommunityIcons name="pencil-outline" size={20} color={EARLY_BLUE} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Bottom sheet with a round icon badge, a title and a body (02/03/04b). */
export function EarlySheet(props: {
  open: boolean;
  icon: IconName;
  title: string;
  body: string;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const { colors, typography } = useTheme();
  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose} />
      <View testID={props.testID} style={[styles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface }]}>
        <View style={styles.grabber} />
        <View style={styles.badge}>
          <MaterialCommunityIcons name={props.icon} size={26} color={EARLY_BLUE} />
        </View>
        <Text style={[typography.h5, { color: colors.text.primary, fontWeight: '700', marginTop: 12 }]}>{props.title}</Text>
        <Text style={[typography.body2, { color: colors.text.primary, marginTop: 6 }]}>{props.body}</Text>
        {props.children}
      </View>
    </Modal>
  );
}

/** Card with a coloured left edge: "Returned early · 3:40 PM" (04, 05, 05a). */
export function EdgeCard(props: {
  tone: 'blue' | 'green';
  icon: IconName;
  title: string;
  body?: string;
  children?: React.ReactNode;
  testID?: string;
}) {
  const { colors, typography, borderRadius, spacing } = useTheme();
  const edge = props.tone === 'green' ? EARLY_GREEN : EARLY_BLUE;
  return (
    <View
      testID={props.testID}
      style={[
        styles.edgeCard,
        {
          borderColor: colors.divider,
          borderLeftColor: edge,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginTop: spacing.md,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MaterialCommunityIcons name={props.icon} size={22} color={props.tone === 'green' ? EARLY_BLUE : EARLY_BLUE} />
        <Text style={[typography.subtitle1, { color: colors.text.primary, fontWeight: '700', marginLeft: 8, flex: 1 }]}>
          {props.title}
        </Text>
      </View>
      {props.body ? (
        <Text style={[typography.body2, { color: colors.text.primary, marginTop: 6 }]}>{props.body}</Text>
      ) : null}
      {props.children}
    </View>
  );
}

/** Two-column money lines (Rental charged $60.00 / Deposit released $180.00). */
export function MoneyLines(props: {
  rows: Array<{ label: string; value: string; positive?: boolean }>;
  note?: string;
  testID?: string;
}) {
  const { colors, typography, borderRadius, spacing } = useTheme();
  return (
    <View
      testID={props.testID}
      style={[
        styles.money,
        { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.md },
      ]}
    >
      {props.rows.map((row) => (
        <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={[typography.body2, { color: colors.text.secondary }]}>{row.label}</Text>
          <Text style={[typography.body2, { fontWeight: '700', color: row.positive ? EARLY_GREEN : colors.text.primary }]}>
            {row.value}
          </Text>
        </View>
      ))}
      {props.note ? (
        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 6 }]}>{props.note}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, paddingTop: 12 },
  action: { alignItems: 'center', flex: 1, minHeight: 72 },
  actionCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  table: { borderWidth: 1, marginTop: 16 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', textDecorationLine: 'line-through' },
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  grabber: { alignSelf: 'center', width: 48, height: 4, borderRadius: 2, backgroundColor: '#D6D3CC', marginBottom: 12 },
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EAF1FB', alignItems: 'center', justifyContent: 'center' },
  edgeCard: { borderWidth: 1, borderLeftWidth: 4 },
  money: { borderWidth: 1 },
});
