import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { SectionCard } from '../common/SectionCard';
import { useTheme } from '../../contexts/ThemeContext';
import { formatReadableAddress, type ReadableAddress } from '../../utils/formatReadableAddress';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export interface OrderFulfillmentPlace {
  icon: IconName;
  label: string;
  name?: string | null;
  address?: ReadableAddress | null;
}

interface OrderFulfillmentCardProps {
  title: string;
  places: OrderFulfillmentPlace[];
  locale: string;
  windowLabel?: string | null;
  windowValue?: string | null;
  style?: StyleProp<ViewStyle>;
}

export function OrderFulfillmentCard({
  title,
  places,
  locale,
  windowLabel,
  windowValue,
  style,
}: OrderFulfillmentCardProps) {
  const { colors, spacing, borderRadius } = useTheme();
  const visible = places.filter((place) => place.name?.trim() || formatReadableAddress(place.address, locale));

  return (
    <SectionCard title={title} style={style}>
      <View style={{ gap: spacing.md }}>
        {visible.map((place) => (
          <PlaceBlock key={place.label} place={place} locale={locale} />
        ))}
        {windowLabel && windowValue ? (
          <View
            style={[
              styles.window,
              {
                backgroundColor: colors.pageBackground,
                borderRadius: borderRadius.md,
                padding: spacing.sm,
              },
            ]}
          >
            <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
              {windowLabel}
            </Text>
            <Text variant="bodyLarge" style={{ color: colors.text.primary, fontWeight: '600', marginTop: 2 }}>
              {windowValue}
            </Text>
          </View>
        ) : null}
      </View>
    </SectionCard>
  );
}

function PlaceBlock({ place, locale }: { place: OrderFulfillmentPlace; locale: string }) {
  const { colors, spacing } = useTheme();
  const address = formatReadableAddress(place.address, locale);
  const name = place.name?.trim() || null;

  return (
    <View style={styles.place} accessibilityLabel={[place.label, name, address].filter(Boolean).join(', ')}>
      <View style={[styles.labelRow, { gap: spacing.xs }]}>
        <MaterialCommunityIcons name={place.icon} size={16} color={colors.text.secondary} />
        <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
          {place.label}
        </Text>
      </View>
      {name ? (
        <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700', marginTop: 4 }}>
          {name}
        </Text>
      ) : null}
      {address ? (
        <Text
          variant="bodyMedium"
          style={{ color: colors.text.primary, lineHeight: 22, marginTop: name ? 4 : 6 }}
        >
          {address}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  place: {},
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  window: {},
});
