import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface CatalogDeliveryTrackBannerProps {
  orderNumber?: string;
  onPress: () => void;
}

export function CatalogDeliveryTrackBanner({ orderNumber, onPress }: CatalogDeliveryTrackBannerProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View
      style={{
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.primary.light,
        backgroundColor: `${colors.primary.main}10`,
      }}
    >
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: borderRadius.sm,
              backgroundColor: `${colors.primary.main}22`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons name="truck-delivery" size={22} color={colors.primary.main} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleSmall" style={{ fontWeight: '700', color: colors.text.primary }}>
              {t('orders.trackYourOrder.note', 'Your order is on its way.')}
              {orderNumber ? ` #${orderNumber}` : ''}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xxs }}>
              {t('orders.trackYourOrder.helper', 'Track your delivery agent on the map in real time.')}
            </Text>
          </View>
        </View>
        <Button mode="contained" icon="map" onPress={onPress} style={{ width: '100%' }}>
          {t('orders.trackYourOrder.cta', 'Track your order')}
        </Button>
      </View>
    </View>
  );
}
