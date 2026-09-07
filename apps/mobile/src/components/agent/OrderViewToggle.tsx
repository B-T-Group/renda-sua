/**
 * OrderViewToggle
 *
 * A compact toggle button that switches between list and map views.
 * Drop it in a screen header or action bar alongside a view state variable.
 *
 * Usage:
 *   const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
 *   ...
 *   <OrderViewToggle mode={viewMode} onToggle={setViewMode} />
 *   {viewMode === 'list' ? <OrderListView ... /> : <OrderMapView ... />}
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

export type OrderViewMode = 'list' | 'map';

export interface OrderViewToggleProps {
  mode: OrderViewMode;
  onToggle: (mode: OrderViewMode) => void;
}

export function OrderViewToggle({ mode, onToggle }: OrderViewToggleProps) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground, borderColor: colors.divider, borderRadius: borderRadius.sm }]}>
      <Pressable
        onPress={() => onToggle('list')}
        style={[
          styles.segment,
          mode === 'list' && { backgroundColor: colors.primary.main, borderRadius: borderRadius.sm - 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('agent.orders.listView', 'List view')}
        accessibilityState={{ selected: mode === 'list' }}
      >
        <MaterialCommunityIcons
          name="view-list"
          size={18}
          color={mode === 'list' ? colors.primary.contrast : colors.text.secondary}
        />
        <Text
          variant="labelSmall"
          style={{ color: mode === 'list' ? colors.primary.contrast : colors.text.secondary, fontWeight: '600' }}
        >
          {t('agent.orders.listView', 'List')}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onToggle('map')}
        style={[
          styles.segment,
          mode === 'map' && { backgroundColor: colors.primary.main, borderRadius: borderRadius.sm - 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('agent.orders.mapView', 'Map view')}
        accessibilityState={{ selected: mode === 'map' }}
      >
        <MaterialCommunityIcons
          name="map-outline"
          size={18}
          color={mode === 'map' ? colors.primary.contrast : colors.text.secondary}
        />
        <Text
          variant="labelSmall"
          style={{ color: mode === 'map' ? colors.primary.contrast : colors.text.secondary, fontWeight: '600' }}
        >
          {t('agent.orders.mapView', 'Map')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 34,
  },
});
