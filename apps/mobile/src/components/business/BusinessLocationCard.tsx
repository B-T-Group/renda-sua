import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import { NoticeBanner } from '../common/NoticeBanner';
import type { BusinessLocation } from '../../types/business/locations';
import { formatBusinessLocationAddress } from '../../utils/businessLocationDisplay';
import { formatOperatingHoursSummary } from '../../utils/operatingHours';
import { spacing } from '../../theme/spacing';

type Props = {
  location: BusinessLocation;
  isStripeRail?: boolean;
  railLoading?: boolean;
  onEdit: () => void;
  onViewItems?: () => void;
};

export function BusinessLocationCard({
  location,
  isStripeRail = false,
  railLoading = false,
  onEdit,
  onViewItems,
}: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const address = formatBusinessLocationAddress(location.address);
  const warning = phoneWarning(location, isStripeRail || railLoading, t);

  return (
    <Pressable
      onPress={onEdit}
      style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.card }]}
    >
      <View style={styles.row}>
        {location.logo_url ? (
          <Image source={{ uri: location.logo_url }} style={styles.logo} />
        ) : null}
        <View style={styles.body}>
          <Text variant="titleMedium">{location.name}</Text>
          <Text style={{ color: colors.text.secondary }}>{address}</Text>
        </View>
        <StatusPill
          label={
            location.is_active
              ? t('business.locations.card.open', 'Open for customers')
              : t('business.locations.card.hidden', 'Hidden from customers')
          }
          backgroundColor={location.is_active ? colors.success.light : colors.surface}
          textColor={location.is_active ? colors.success.dark : colors.text.secondary}
        />
      </View>
      <Text style={{ color: colors.text.secondary }}>
        {formatOperatingHoursSummary(location.operating_hours, t)}
        {!isStripeRail && !railLoading && location.pay_at_confirm
          ? ` · ${t('business.locations.payAfter.label', 'Ask customers to pay after you confirm')}`
          : ''}
      </Text>
      {warning ? <NoticeBanner tone="warning" message={warning} /> : null}
      <View style={styles.actions}>
        <Button mode="contained" onPress={onEdit}>
          {t('business.locations.card.settings', 'Settings')}
        </Button>
        {onViewItems ? (
          <Button mode="text" onPress={onViewItems}>
            {t('business.locations.manageItems', 'Manage items')}
          </Button>
        ) : null}
      </View>
    </Pressable>
  );
}

function phoneWarning(
  location: BusinessLocation,
  hideMomo: boolean,
  t: (key: string, fallback: string) => string
): string | null {
  if (hideMomo) return null;
  if (!location.mobile_payment_phone) {
    return t('business.locations.card.addPhone', 'Add a Mobile Money number');
  }
  if (!location.mobile_payment_phone.is_verified) {
    return t('business.locations.card.verifyPhone', 'Verify your mobile money number');
  }
  return null;
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { flex: 1 },
  logo: { width: 44, height: 44, borderRadius: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
