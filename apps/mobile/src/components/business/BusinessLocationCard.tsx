import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import { NoticeBanner } from '../common/NoticeBanner';
import { LocationOptionArt } from './location-edit/LocationOptionArt';
import type { BusinessLocation } from '../../types/business/locations';
import { formatBusinessLocationAddress } from '../../utils/businessLocationDisplay';
import { formatOperatingHoursSummary } from '../../utils/operatingHours';
import { spacing } from '../../theme/spacing';

type Props = {
  location: BusinessLocation;
  isStripeRail?: boolean;
  railLoading?: boolean;
  onEdit: () => void;
  onHours: () => void;
  onViewItems?: () => void;
};

export function BusinessLocationCard({
  location,
  isStripeRail = false,
  railLoading = false,
  onEdit,
  onHours,
  onViewItems,
}: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius, shadows } = useTheme();
  const address = formatBusinessLocationAddress(location.address);
  const warning = phoneWarning(location, isStripeRail || railLoading, t);
  const open = location.is_active;

  return (
    <Pressable
      onPress={onEdit}
      style={[
        styles.card,
        shadows.sm,
        { backgroundColor: colors.surface, borderRadius: borderRadius.card },
      ]}
    >
      <View style={styles.head}>
        <PlaceMark logoUrl={location.logo_url} />
        <View style={styles.copy}>
          <Text variant="titleMedium" style={{ color: colors.text.primary }}>
            {location.name}
          </Text>
          {address ? (
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, lineHeight: 22 }}>
              {address}
            </Text>
          ) : null}
        </View>
      </View>
      <StatusPill
        label={
          open
            ? t('business.locations.card.open', 'Open for customers')
            : t('business.locations.card.hidden', 'Hidden from customers')
        }
        backgroundColor={open ? colors.successTint : colors.primaryTint}
        textColor={open ? colors.success.dark : colors.text.secondary}
      />
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, lineHeight: 22 }}>
        {formatOperatingHoursSummary(location.operating_hours, t)}
      </Text>
      {!isStripeRail && !railLoading && location.pay_at_confirm ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, lineHeight: 22 }}>
          {t('business.locations.editPage.payLine', 'Customers can pay after you confirm.')}
        </Text>
      ) : null}
      {warning ? <NoticeBanner tone="warning" message={warning} /> : null}
      <View style={styles.actions}>
        <Button mode="contained" onPress={onEdit}>
          {t('business.locations.card.settings', 'Settings')}
        </Button>
        <Button mode="outlined" onPress={onHours}>
          {t('business.locations.hours.setNow', 'Set hours')}
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

function PlaceMark({ logoUrl }: { logoUrl?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.mark, { backgroundColor: colors.primary.hover }]}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={styles.logo} />
      ) : (
        <LocationOptionArt kind="store" size={56} />
      )}
    </View>
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
  card: { padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: 4 },
  mark: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 64, height: 64, borderRadius: 20 },
  actions: { gap: spacing.sm },
});
