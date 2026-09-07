import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAgentActiveDelivery } from '../../contexts/AgentActiveDeliveryContext';
import { DeliveryStatusIndicator, statusToTone, statusToLabel } from './DeliveryStatusIndicator';

/**
 * Persistent banner shown at the top of all agent screens when an active
 * delivery exists. Tapping navigates to the Active Orders tab.
 */
export const PersistentActiveDeliveryHeader = observer(function PersistentActiveDeliveryHeader() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation<any>();
  const delivery = useAgentActiveDelivery();

  const goToOrders = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Orders' });
  }, [navigation]);

  if (!delivery.activeOrder) return null;

  const order = delivery.activeOrder;
  const tone = statusToTone(order.current_status);
  const statusLabel = statusToLabel(order.current_status, t);

  const bannerBg =
    tone === 'success'
      ? colors.success.main + '14'
      : tone === 'active'
        ? colors.primaryTint
        : colors.warning.main + '14';

  const bannerBorder =
    tone === 'success'
      ? colors.success.main + '50'
      : tone === 'active'
        ? colors.primary.main + '50'
        : colors.warning.main + '50';

  const accentColor =
    tone === 'success'
      ? colors.success.main
      : tone === 'active'
        ? colors.primary.main
        : colors.warning.main;

  return (
    <Pressable
      onPress={goToOrders}
      style={({ pressed }) => [
        styles.banner,
        {
          backgroundColor: bannerBg,
          borderBottomColor: bannerBorder,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('agent.activeDelivery.bannerA11y', 'View active delivery')}
    >
      <View style={styles.iconCol}>
        <MaterialCommunityIcons name="truck-fast" size={22} color={accentColor} />
      </View>
      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          <Text variant="labelMedium" style={[styles.bannerTitle, { color: accentColor }]}>
            {t('agent.activeDelivery.bannerTitle', 'Active Delivery')}
          </Text>
          <DeliveryStatusIndicator label={statusLabel} tone={tone} compact />
        </View>
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={[styles.orderNumber, { color: colors.text.primary }]}
        >
          {t('agent.openOrders.orderNumber', '#{{num}}', { num: order.order_number })}
        </Text>
        <Text variant="bodySmall" style={[styles.subtitle, { color: colors.text.secondary }]}>
          {t(
            'agent.statusBar.liveLocationShared',
            'Customer can see your live location'
          )}
        </Text>
      </View>
      <View style={styles.chevronCol}>
        <Text variant="labelMedium" style={[styles.ctaText, { color: accentColor }]}>
          {t('agent.activeDelivery.continue', 'Continue')}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={accentColor} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    gap: 10,
  },
  iconCol: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerTitle: {
    fontWeight: '700',
  },
  orderNumber: {
    fontWeight: '600',
  },
  subtitle: {
    lineHeight: 16,
  },
  chevronCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  ctaText: {
    fontWeight: '700',
  },
});
