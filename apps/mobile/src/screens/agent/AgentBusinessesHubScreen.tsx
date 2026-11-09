import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { AgentRootStackParamList } from '../../navigation/AgentRootNavigator';
import { AgentBusinessReferralContent } from '../../components/referrals/AgentBusinessReferralContent';
import { DesignatedListSection } from '../../components/dedicated/DesignatedListSection';
import { StatusPill } from '../../components/common/StatusPill';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import {
  countApplicableDedicatedOpenings,
  groupDedicatedHomeStores,
  resolveBusinessesHubTab,
  sortDedicatedSlotKeys,
  type BusinessesHubTab,
  type DedicatedHomeStore,
} from '../../utils/dedicatedStoresHome';
import { useAgentFocus } from '../../hooks/useAgentFocus';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<AgentRootStackParamList, 'AgentBusinessesHub'>;
type Tab = BusinessesHubTab;
type HubSegment = 'stores' | 'opportunities';

export default function AgentBusinessesHubScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showDelivery, showCommercial } = useAgentFocus(true);
  const initial = resolveBusinessesHubTab(route.params?.tab, showDelivery, showCommercial);
  const [tab, setTab] = useState<Tab>(initial);
  const [stores, setStores] = useState<DedicatedHomeStore[]>([]);
  const [openingCount, setOpeningCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const next = route.params?.tab;
    if (next === 'dedicated' || next === 'referred') setTab(next);
  }, [route.params?.tab]);

  const loadStores = useCallback(async () => {
    try {
      const res = await dedicatedAgentsService.getMyAssignments();
      setStores(groupDedicatedHomeStores(res?.assignments));
    } catch {
      setStores([]);
    }
  }, []);

  const loadOpeningCount = useCallback(async () => {
    try {
      const res = await dedicatedAgentsService.getOpportunities();
      setOpeningCount(countApplicableDedicatedOpenings(res?.opportunities));
    } catch {
      setOpeningCount(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tab !== 'dedicated' || !showDelivery) return;
      void loadStores();
      void loadOpeningCount();
    }, [tab, showDelivery, loadStores, loadOpeningCount])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (tab === 'dedicated') {
      await Promise.all([loadStores(), loadOpeningCount()]);
    }
    setRefreshing(false);
  }, [tab, loadStores, loadOpeningCount]);

  const buttons = [
    showDelivery
      ? {
          value: 'dedicated' as const,
          label: t('agent.myBusinesses.tabDedicated', 'Dedicated'),
        }
      : null,
    showCommercial
      ? {
          value: 'referred' as const,
          label: t('agent.myBusinesses.tabReferred', 'Referred'),
        }
      : null,
  ].filter(Boolean) as Array<{ value: Tab; label: string }>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      {buttons.length > 1 ? (
        <View style={{ padding: spacing.md }}>
          <SegmentedButtons
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            buttons={buttons}
          />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          paddingTop: buttons.length > 1 ? 0 : spacing.md,
        }}
        refreshControl={
          tab === 'dedicated' ? (
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {tab === 'dedicated' && showDelivery ? (
          <DedicatedTab
            stores={stores}
            openingCount={openingCount}
            onOpenHub={(segment) => navigation.navigate('DedicatedHub', { segment })}
          />
        ) : null}
        {tab === 'referred' && showCommercial ? <AgentBusinessReferralContent /> : null}
      </ScrollView>
    </View>
  );
}

function DedicatedTab({
  stores,
  openingCount,
  onOpenHub,
}: {
  stores: DedicatedHomeStore[];
  openingCount: number | null;
  onOpenHub: (segment: HubSegment) => void;
}) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const openingsTitle =
    openingCount != null && openingCount > 0
      ? t('agent.myBusinesses.openingsTitleCount', {
          count: openingCount,
          defaultValue: '{{count}} store opening to apply',
          defaultValue_plural: '{{count}} store openings to apply',
        })
      : t('agent.myBusinesses.openingsTitleEmpty', 'Browse store openings');

  return (
    <View style={{ gap: spacing.md }}>
      <DedicatedExplainer />
      <View style={{ marginHorizontal: -spacing.md }}>
        <DesignatedListSection showWhenEmpty />
      </View>
      <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t('agent.myBusinesses.dedicatedStoresTitle', 'Your dedicated stores')}
      </Text>
      {stores.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t(
            'agent.myBusinesses.dedicatedEmpty',
            'You are not a dedicated agent for any store yet. Apply to openings below.'
          )}
        </Text>
      ) : (
        stores.map((store) => <StoreRow key={store.locationId} store={store} />)
      )}
      <HubActionCard
        testID="businesses-hub-openings"
        icon="briefcase-search-outline"
        title={openingsTitle}
        subtitle={t(
          'agent.myBusinesses.openingsSubtitle',
          'New dedicated delivery spots at nearby stores — apply to join'
        )}
        badge={openingCount != null && openingCount > 0 ? String(openingCount) : null}
        onPress={() => onOpenHub('opportunities')}
        borderRadius={borderRadius.md}
      />
      <HubActionCard
        testID="businesses-hub-manage"
        icon="storefront-outline"
        title={t('agent.myBusinesses.hubManageTitle', 'Dedicated hub')}
        subtitle={t(
          'agent.myBusinesses.hubManageSubtitle',
          'Manage your stores and see all openings in one place'
        )}
        badge={null}
        onPress={() => onOpenHub('stores')}
        borderRadius={borderRadius.md}
      />
    </View>
  );
}

function DedicatedExplainer() {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  return (
    <View
      style={[
        styles.explainer,
        { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: borderRadius.md },
      ]}
      testID="dedicated-explainer"
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t('agent.myBusinesses.explainerTitle', 'Two things on this tab')}
      </Text>
      <ExplainerRow
        icon="package-variant-closed"
        title={t('agent.myBusinesses.ordersExplainerTitle', 'Dedicated orders')}
        body={t(
          'agent.myBusinesses.ordersExplainerBody',
          'Deliveries from your dedicated stores that you can take now'
        )}
      />
      <ExplainerRow
        icon="store-plus-outline"
        title={t('agent.myBusinesses.hubExplainerTitle', 'Dedicated hub')}
        body={t(
          'agent.myBusinesses.hubExplainerBody',
          'Where you apply to new store openings or manage the stores you already cover'
        )}
      />
    </View>
  );
}

function ExplainerRow({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.explainerRow}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary.main} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
          {title}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {body}
        </Text>
      </View>
    </View>
  );
}

function HubActionCard({
  testID,
  icon,
  title,
  subtitle,
  badge,
  onPress,
  borderRadius,
}: {
  testID: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  subtitle: string;
  badge: string | null;
  onPress: () => void;
  borderRadius: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.hubCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={24} color={colors.primary.main} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.hubTitleRow}>
          <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700', flex: 1 }}>
            {title}
          </Text>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: colors.primary.main, borderRadius: 999 }]}>
              <Text variant="labelSmall" style={{ color: '#fff', fontWeight: '700' }}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {subtitle}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text.secondary} />
    </Pressable>
  );
}

function StoreRow({ store }: { store: DedicatedHomeStore }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const slots = sortDedicatedSlotKeys(store.slotKeys);
  return (
    <View style={[styles.store, { borderBottomColor: colors.divider }]}>
      <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '600' }}>
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
  store: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  explainer: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  explainerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hubTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  badge: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
  },
});
