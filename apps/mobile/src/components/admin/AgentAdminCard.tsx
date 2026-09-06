import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { UserAdminCardHeader } from './UserAdminCardHeader';
import { StatusPill } from '../common/StatusPill';
import { AdminReferralMeta } from './AdminReferralMeta';
import { AdminApplyReferralSheet } from './AdminApplyReferralSheet';
import type { AdminAgentUser } from '../../types/adminUsers';

interface Props {
  item: AdminAgentUser;
  onPress?: (item: AdminAgentUser) => void;
  onApplyReferral?: (
    id: string,
    code: string,
    referrer?: { name: string; kind: 'agent' | 'business' }
  ) => Promise<void>;
}

export function AgentAdminCard({ item, onPress, onApplyReferral }: Props) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const [applyOpen, setApplyOpen] = useState(false);

  const verifiedPill = item.is_verified
    ? {
        label: t('admin.users.agent.verified', 'Verified'),
        bg: `${colors.success.main}22`,
        text: colors.success.dark ?? colors.success.main,
      }
    : {
        label: t('admin.users.agent.unverified', 'Unverified'),
        bg: `${colors.error.main}18`,
        text: colors.error.dark ?? colors.error.main,
      };

  const cardChrome = {
    backgroundColor: colors.surface,
    borderColor: colors.divider,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  };

  return (
    <View style={[styles.card, cardChrome]}>
      <Pressable
        onPress={onPress ? () => onPress(item) : undefined}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${item.user.first_name} ${item.user.last_name}`}
      >
      <UserAdminCardHeader
        firstName={item.user.first_name}
        lastName={item.user.last_name}
        email={item.user.email}
        phone={item.user.phone_number}
        accentColor={`${colors.secondary?.main ?? colors.primary.main}22`}
      />

      {/* Pills row */}
      <View style={[styles.pillsRow, { marginTop: spacing.sm }]}>
        <StatusPill
          compact
          label={verifiedPill.label}
          backgroundColor={verifiedPill.bg}
          textColor={verifiedPill.text}
          icon={item.is_verified ? 'check-circle-outline' : 'alert-circle-outline'}
        />
        {item.is_internal ? (
          <StatusPill
            compact
            label={t('admin.users.agent.internal', 'Internal')}
            backgroundColor={`${colors.info.main}18`}
            textColor={colors.info.dark ?? colors.info.main}
            icon="office-building-outline"
          />
        ) : null}
        {item.vehicle_type?.name ? (
          <StatusPill
            compact
            label={item.vehicle_type.name}
            backgroundColor={`${colors.text.secondary}14`}
            textColor={colors.text.secondary}
            icon="motorbike"
          />
        ) : null}
      </View>

      {/* Stats row */}
      <View style={[styles.statsRow, { marginTop: spacing.xs ?? 6 }]}>
        {item.status ? (
          <View style={styles.statCell}>
            <MaterialCommunityIcons
              name="circle-small"
              size={16}
              color={
                item.status === 'active'
                  ? colors.success.main
                  : colors.text.secondary
              }
            />
            <Text
              style={[typography.caption, { color: colors.text.secondary }]}
              numberOfLines={1}
            >
              {item.status}
            </Text>
          </View>
        ) : null}
        <View style={styles.statCell}>
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={14}
            color={colors.text.secondary}
          />
          <Text
            style={[typography.caption, { color: colors.text.secondary, marginLeft: 4 }]}
            numberOfLines={1}
          >
            {item.addresses?.find((a) => a.city)?.city ??
              t('common.unknown', 'Unknown')}
          </Text>
        </View>
      </View>
      </Pressable>

      <AdminReferralMeta
        referralCode={item.referralCode}
        referredBy={item.referredBy}
        createdAt={item.created_at}
        onApply={
          item.referredBy || !onApplyReferral
            ? undefined
            : () => setApplyOpen(true)
        }
      />
      {onApplyReferral ? (
        <AdminApplyReferralSheet
          visible={applyOpen}
          onDismiss={() => setApplyOpen(false)}
          onSubmit={(code, referrer) => onApplyReferral(item.id, code, referrer)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  statCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
