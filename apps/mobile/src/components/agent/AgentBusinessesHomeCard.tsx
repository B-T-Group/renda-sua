/**
 * Agent Home: one “Businesses” entry for dedicated stores + referred merchants.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import { SkeletonBone } from '../common/SkeletonBone';
import { spacing } from '../../theme/spacing';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import {
  groupDedicatedHomeStores,
  sortDedicatedSlotKeys,
  type DedicatedHomeStore,
} from '../../utils/dedicatedStoresHome';

const MAX_STORE_ROWS = 2;

export type BusinessesHubTab = 'dedicated' | 'referred';

type Props = {
  showDedicated: boolean;
  showReferred: boolean;
  referredCount: number | null;
  referredLoading: boolean;
  onOpen: (tab: BusinessesHubTab) => void;
};

export default function AgentBusinessesHomeCard({
  showDedicated,
  showReferred,
  referredCount,
  referredLoading,
  onOpen,
}: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const [stores, setStores] = useState<DedicatedHomeStore[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!showDedicated) {
        setStores([]);
        return;
      }
      let active = true;
      dedicatedAgentsService
        .getMyAssignments()
        .then((res) => active && setStores(groupDedicatedHomeStores(res?.assignments)))
        .catch(() => active && setStores([]));
      return () => {
        active = false;
      };
    }, [showDedicated])
  );

  const dedicatedVisible = showDedicated && stores.length > 0;
  const referredVisible = showReferred;
  if (!dedicatedVisible && !referredVisible) return null;

  return (
    <View
      testID="home-businesses-card"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          borderColor: colors.divider,
        },
      ]}
    >
      <View style={[styles.header, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.sm }]}>
        <MaterialCommunityIcons name="storefront-outline" size={22} color={colors.primary.main} />
        <Text variant="titleSmall" style={{ flex: 1, fontWeight: '700', color: colors.text.primary }}>
          {t('agent.myBusinesses.homeTitle', 'Businesses')}
        </Text>
      </View>

      {dedicatedVisible ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen('dedicated')}
          style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, gap: spacing.sm }]}
        >
          <View style={styles.sectionHeader}>
            <Text variant="labelMedium" style={{ color: colors.text.secondary, flex: 1 }}>
              {t('agent.myBusinesses.homeDedicatedLabel', 'Dedicated stores')}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary.main} />
          </View>
          {stores.slice(0, MAX_STORE_ROWS).map((store, index) => (
            <StorePreview
              key={store.locationId}
              store={store}
              showDivider={
                index < Math.min(stores.length, MAX_STORE_ROWS) - 1 ||
                stores.length > MAX_STORE_ROWS ||
                referredVisible
              }
            />
          ))}
          {stores.length > MAX_STORE_ROWS ? (
            <Text variant="labelMedium" style={{ color: colors.primary.main, fontWeight: '600' }}>
              {t('dedicatedAgents.agent.homeStores.more', '+{{count}} more', {
                count: stores.length - MAX_STORE_ROWS,
              })}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      {referredVisible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            'agent.businessReferrals.heroA11y',
            'Businesses referred so far. Tap to learn about referring businesses.'
          )}
          onPress={() => onOpen('referred')}
          style={({ pressed }) => [
            styles.referredRow,
            {
              opacity: pressed ? 0.92 : 1,
              borderTopWidth: dedicatedVisible ? StyleSheet.hairlineWidth : 0,
              borderTopColor: colors.divider,
              paddingTop: dedicatedVisible ? spacing.sm : 0,
            },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
              {t('agent.myBusinesses.homeReferredLabel', 'Referred')}
            </Text>
            {referredLoading && referredCount == null ? (
              <SkeletonBone height={24} width={48} style={{ marginTop: 4 }} />
            ) : (
              <Text
                variant="titleLarge"
                style={{ color: colors.text.primary, fontWeight: '700', marginTop: 2 }}
              >
                {(referredCount ?? 0).toLocaleString()}
              </Text>
            )}
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
              {(referredCount ?? 0) === 0 && !referredLoading
                ? t(
                    'agent.businessReferrals.heroEmptyHint',
                    'Tap to learn how referring businesses earns you commission'
                  )
                : t(
                    'agent.businessReferrals.heroHint',
                    'Tap to see benefits, responsibilities, and your code'
                  )}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary.main} />
        </Pressable>
      ) : null}
    </View>
  );
}

function StorePreview({ store, showDivider }: { store: DedicatedHomeStore; showDivider: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const slots = sortDedicatedSlotKeys(store.slotKeys);
  return (
    <View
      style={[
        styles.store,
        showDivider ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider } : null,
      ]}
    >
      <Text variant="titleSmall" numberOfLines={2} style={{ color: colors.text.primary, fontWeight: '600' }}>
        {store.storeName}
      </Text>
      <View style={styles.chips}>
        {store.paused ? (
          <StatusPill
            compact
            label={t('dedicatedAgents.agent.homeStores.paused', 'Paused')}
            backgroundColor={colors.warningTint}
            textColor={colors.warning.dark}
            borderColor={colors.warning.main}
          />
        ) : (
          slots.map((key) => (
            <StatusPill
              key={key}
              compact
              label={t(`dedicatedAgents.slots.${key}`, key)}
              backgroundColor={colors.primaryTint}
              textColor={colors.primary.dark}
            />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  store: { gap: spacing.xs, paddingBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  referredRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
