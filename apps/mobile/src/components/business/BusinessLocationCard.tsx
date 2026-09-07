import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import { InfoRow } from '../common/InfoRow';
import { OperatingHoursSummary } from './OperatingHoursSummary';
import type { BusinessLocation, LocationAccountSummary } from '../../types/business/locations';
import {
  formatBusinessLocationAddress,
  formatOperatingHoursSummary,
  locationTypeLabelKey,
} from '../../utils/businessLocationDisplay';
import { formatCurrency } from '../../utils/formatters';
import { shadows } from '../../theme/shadows';
import { getPlanById } from '../../types/business/accountType';

type Props = {
  location: BusinessLocation;
  account?: LocationAccountSummary | null;
  isStripeRail?: boolean;
  transferPending?: boolean;
  /** Business account type for commission display — passed from the parent screen. */
  businessAccountType?: string | null;
  onEdit: () => void;
  onToggleStatus: () => void;
  onTransfer?: () => void;
  onViewItems?: () => void;
  onDelete?: () => void;
  onEditHours?: () => void;
  /** Empty or change: open select-existing / add-new chooser. */
  onChoosePhone?: (location: BusinessLocation) => void;
  /** Linked but unverified: start verification for the linked number. */
  onVerifyPhone?: (location: BusinessLocation) => void;
  /** Unlink from this location only — never deletes the registry phone. */
  onUnlinkPhone?: (location: BusinessLocation) => void;
};

export function BusinessLocationCard({
  location,
  account,
  isStripeRail = false,
  transferPending = false,
  businessAccountType,
  onEdit,
  onToggleStatus,
  onTransfer,
  onViewItems,
  onDelete,
  onEditHours,
  onChoosePhone,
  onVerifyPhone,
  onUnlinkPhone,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const addressLine = formatBusinessLocationAddress(location.address);
  const hoursSummary = formatOperatingHoursSummary(location.operating_hours, t);
  const autoOn = location.auto_withdraw_commissions !== false;
  const accentColor = location.is_active ? colors.success.main : colors.text.disabled;

  const linkedPhone = location.mobile_payment_phone;
  const phoneVerified = linkedPhone?.is_verified === true;
  const displayPhone = linkedPhone?.phone_e164 ?? location.phone?.trim() ?? '';
  const needsPhoneSetup = !isStripeRail && !linkedPhone;
  const needsPhoneVerify = !isStripeRail && !!linkedPhone && !phoneVerified;
  const phoneActionLabel = needsPhoneSetup
    ? t('mobilePaymentPhone.setCta', 'Set mobile money number')
    : t('mobilePaymentPhone.confirmCta', 'Confirm mobile money number');
  const locationPaymentMessage = needsPhoneSetup
    ? t(
        'mobilePaymentPhone.locationAddCta',
        'Add and confirm a mobile money number so customers can purchase from this location.'
      )
    : t(
        'mobilePaymentPhone.locationConfirmCta',
        'Confirm your mobile money number so customers can purchase from this location.'
      );

  const plan = getPlanById(businessAccountType);
  const commissionText = `${plan.commissionPercent}% (${t(plan.labelKey, plan.defaultLabel)})`;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderLeftColor: accentColor,
          borderColor: colors.divider,
          borderRadius: borderRadius.card,
          backgroundColor: colors.surface,
          opacity: location.is_active ? 1 : 0.72,
          marginBottom: spacing.sm,
        },
      ]}
    >
      {/* Header */}
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={t('business.locations.edit', 'Edit')}
        style={[styles.header, { padding: spacing.md, paddingBottom: 0 }]}
      >
        {location.logo_url?.trim() ? (
          <Image
            source={{ uri: location.logo_url.trim() }}
            style={[styles.logo, { borderRadius: borderRadius.sm }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.logo,
              {
                backgroundColor: colors.primary.main + '1A',
                borderRadius: borderRadius.sm,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <MaterialCommunityIcons name="store" size={28} color={colors.primary.main} />
          </View>
        )}
        <Text variant="titleMedium" style={[styles.name, { color: colors.text.primary }]} numberOfLines={3}>
          {location.name}
        </Text>
      </Pressable>

      {/* Status badges */}
      <View style={[styles.badges, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
        <StatusPill
          compact
          label={
            location.is_active
              ? t('business.locations.active', 'Active')
              : t('business.locations.inactive', 'Inactive')
          }
          backgroundColor={location.is_active ? `${colors.success.main}24` : colors.divider}
          textColor={location.is_active ? colors.success.dark : colors.text.secondary}
        />
        {location.is_primary ? (
          <StatusPill
            compact
            label={t('business.locations.primary', 'Primary')}
            backgroundColor={`${colors.primary.main}1f`}
            textColor={colors.primary.dark}
          />
        ) : null}
        {transferPending ? (
          <StatusPill
            compact
            label={t('business.locations.transfer.pendingBadge', 'Transfer pending')}
            backgroundColor={`${colors.warning.main}24`}
            textColor={colors.warning.dark}
          />
        ) : null}
        <StatusPill
          compact
          label={t(locationTypeLabelKey(location.location_type), location.location_type)}
          backgroundColor={colors.divider}
          textColor={colors.text.secondary}
          borderColor={colors.border}
        />
      </View>

      {/* Details */}
      <View style={[styles.details, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
        {addressLine ? (
          <InfoRow icon="map-marker-outline" label={t('common.address', 'Address')} value={addressLine} vertical />
        ) : null}

        <InfoRow
          icon="percent"
          label={t('business.locations.commissionManagedBy', 'Commission — Managed by your Business Account')}
          value={commissionText}
        />

        <InfoRow
          icon="phone-sync-outline"
          label={t('business.locations.autoWithdrawStatus', 'Auto payouts')}
          value={
            autoOn
              ? t('business.locations.autoWithdrawOn', 'On')
              : t('business.locations.autoWithdrawOff', 'Off')
          }
        />

        {!isStripeRail && autoOn && !displayPhone ? (
          <Text variant="labelSmall" style={[styles.hint, { color: colors.warning.main }]}>
            {t(
              'business.locations.autoWithdrawNeedsPhone',
              'Add a phone number for automatic payouts to work.'
            )}
          </Text>
        ) : null}

        {!isStripeRail && (needsPhoneSetup || needsPhoneVerify) ? (
          <View
            style={[
              styles.verifyBox,
              {
                marginTop: spacing.xs,
                padding: spacing.sm,
                borderRadius: borderRadius.sm,
                backgroundColor: `${colors.warning.main}14`,
                borderColor: colors.warning.main,
              },
            ]}
          >
            <Text variant="bodySmall" style={{ color: colors.text.primary, marginBottom: spacing.xs }}>
              {locationPaymentMessage}
            </Text>
            <Button
              mode="contained"
              compact
              onPress={() =>
                needsPhoneSetup ? onChoosePhone?.(location) : onVerifyPhone?.(location)
              }
            >
              {phoneActionLabel}
            </Button>
          </View>
        ) : null}

        {!isStripeRail && displayPhone ? (
          <>
            <View style={styles.phoneRow}>
              <InfoRow icon="phone-outline" label={t('common.phone', 'Phone')} value={displayPhone} />
              {linkedPhone ? (
                <StatusPill
                  compact
                  label={
                    phoneVerified
                      ? t('mobilePaymentPhone.verified', 'Verified')
                      : t('mobilePaymentPhone.unverified', 'Unverified')
                  }
                  backgroundColor={
                    phoneVerified ? `${colors.success.main}24` : `${colors.warning.main}24`
                  }
                  textColor={phoneVerified ? colors.success.dark : colors.warning.dark}
                />
              ) : null}
            </View>
            {!isStripeRail && linkedPhone ? (
              <View style={styles.phoneActions}>
                <Button mode="text" compact onPress={() => onChoosePhone?.(location)}>
                  {t('mobilePaymentPhone.change', 'Change')}
                </Button>
                <Button
                  mode="text"
                  compact
                  textColor={colors.error.main}
                  onPress={() => onUnlinkPhone?.(location)}
                >
                  {t('mobilePaymentPhone.unlink', 'Unlink')}
                </Button>
              </View>
            ) : null}
            <Text variant="labelSmall" style={[styles.hint, { color: colors.text.secondary }]}>
              {t(
                'business.locations.phoneWithdrawalNote',
                "Used for withdrawals from this location's account"
              )}
            </Text>
          </>
        ) : null}

        {location.email?.trim() ? (
          <InfoRow icon="email-outline" label={t('common.email', 'Email')} value={location.email} />
        ) : null}
      </View>

      {/* Operating hours */}
      <View
        style={[
          styles.hoursBox,
          {
            marginHorizontal: spacing.md,
            marginTop: spacing.sm,
            padding: spacing.sm,
            borderRadius: borderRadius.sm,
            borderColor: colors.divider,
            backgroundColor: colors.pageBackground,
          },
        ]}
      >
        <Pressable
          onPress={() => setHoursExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: hoursExpanded }}
          style={styles.hoursHeader}
        >
          <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary.main} />
          <View style={styles.hoursHeaderText}>
            <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
              {t('business.locations.operatingHours.title', 'Operating hours')}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.text.primary, fontWeight: '500' }}
              numberOfLines={1}
            >
              {hoursSummary}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={hoursExpanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={colors.text.secondary}
          />
        </Pressable>
        {hoursExpanded ? (
          <View style={{ marginTop: spacing.sm }}>
            <OperatingHoursSummary operatingHours={location.operating_hours} />
            {onEditHours ? (
              <Button
                mode="text"
                compact
                icon="pencil-outline"
                onPress={onEditHours}
                style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
              >
                {t('business.locations.operatingHours.edit', 'Edit hours')}
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Account balance */}
      {account ? (
        <View
          style={[
            styles.accountBox,
            {
              marginHorizontal: spacing.md,
              marginTop: spacing.sm,
              padding: spacing.sm,
              borderRadius: borderRadius.sm,
              borderColor: colors.divider,
              backgroundColor: colors.pageBackground,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 }}>
            <MaterialCommunityIcons name="bank-outline" size={16} color={colors.primary.main} />
            <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
              {t('business.locations.locationAccount', 'Location account')}
            </Text>
          </View>
          <Text variant="titleMedium" style={{ color: colors.primary.main, fontWeight: '600' }}>
            {formatCurrency(account.total_balance, account.currency)}
          </Text>
          <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
            {t('accounts.availableBalance', 'Available')}:{' '}
            {formatCurrency(account.available_balance, account.currency)}
          </Text>
        </View>
      ) : null}

      {/* Actions */}
      <View
        style={[
          styles.actions,
          {
            borderTopColor: colors.divider,
            marginTop: spacing.sm,
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xs,
          },
        ]}
      >
        <Button mode="text" icon="pencil" onPress={onEdit} compact>
          {t('business.locations.edit', 'Edit')}
        </Button>
        {onViewItems ? (
          <Button mode="text" icon="package-variant" onPress={onViewItems} compact>
            {t('stores.manageItems', 'Manage items')}
          </Button>
        ) : null}
        {onTransfer && !location.is_primary && !transferPending ? (
          <Button mode="text" icon="swap-horizontal" onPress={onTransfer} compact>
            {t('business.locations.transfer.action', 'Transfer')}
          </Button>
        ) : null}
        {onDelete && !location.is_primary ? (
          <Button
            mode="text"
            icon="delete-outline"
            textColor={colors.error.main}
            onPress={onDelete}
            compact
          >
            {t('business.locations.deleteLocation', 'Delete')}
          </Button>
        ) : null}
        <Button mode="outlined" onPress={onToggleStatus} compact>
          {location.is_active
            ? t('business.locations.deactivate', 'Deactivate')
            : t('business.locations.activate', 'Activate')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logo: { width: 56, height: 56, flexShrink: 0 },
  name: { flex: 1, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  details: { gap: 2 },
  accountBox: { borderWidth: StyleSheet.hairlineWidth },
  hoursBox: { borderWidth: StyleSheet.hairlineWidth },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoursHeaderText: { flex: 1, minWidth: 0, gap: 2 },
  hint: { marginLeft: 4, fontStyle: 'italic', marginTop: 2 },
  verifyBox: { borderWidth: StyleSheet.hairlineWidth },
  phoneRow: { gap: 4 },
  phoneActions: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: 4 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
