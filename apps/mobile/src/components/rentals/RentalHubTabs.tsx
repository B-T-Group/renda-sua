import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamily } from '../../theme/fonts';
import type { RentalHubGroup } from '../../utils/rentals';

export interface RentalHubTab {
  value: RentalHubGroup;
  label: string;
  count?: number;
}

export function RentalHubTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: RentalHubTab[];
  value: RentalHubGroup;
  onChange: (next: RentalHubGroup) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tabs.map((tab) => {
          const selected = tab.value === value;
          return (
            <Pressable
              key={tab.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(tab.value)}
              style={[styles.tab, selected && { backgroundColor: colors.primary.main + '22' }]}
            >
              <Text style={[styles.label, { color: selected ? colors.primary.main : colors.text.primary }]}>
                {tab.label}
              </Text>
              {tab.count != null && tab.count > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.primary.main }]}>
                  <Text style={styles.badgeText}>{tab.count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, borderWidth: 1 },
  row: { flexDirection: 'row', padding: 4, gap: 4 },
  tab: {
    minHeight: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
  },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, textAlign: 'center' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontFamily: fontFamily.bold, fontSize: 11 },
});
