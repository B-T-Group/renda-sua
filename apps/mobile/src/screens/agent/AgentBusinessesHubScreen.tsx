import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, SegmentedButtons, Text } from 'react-native-paper';
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
  groupDedicatedHomeStores,
  sortDedicatedSlotKeys,
  type DedicatedHomeStore,
} from '../../utils/dedicatedStoresHome';
import { useAgentFocus } from '../../hooks/useAgentFocus';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<AgentRootStackParamList, 'AgentBusinessesHub'>;
type Tab = 'dedicated' | 'referred';

export default function AgentBusinessesHubScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { showDelivery, showCommercial } = useAgentFocus(true);
  const initial = resolveInitialTab(route.params?.tab, showDelivery, showCommercial);
  const [tab, setTab] = useState<Tab>(initial);
  const [stores, setStores] = useState<DedicatedHomeStore[]>([]);
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

  useFocusEffect(
    useCallback(() => {
      if (tab === 'dedicated' && showDelivery) void loadStores();
    }, [tab, showDelivery, loadStores])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (tab === 'dedicated') await loadStores();
    setRefreshing(false);
  }, [tab, loadStores]);

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
            onOpenHub={(segment) => navigation.navigate('DedicatedHub', { segment })}
          />
        ) : null}
        {tab === 'referred' && showCommercial ? <AgentBusinessReferralContent /> : null}
      </ScrollView>
    </View>
  );
}

function resolveInitialTab(
  param: Tab | undefined,
  showDelivery: boolean,
  showCommercial: boolean
): Tab {
  if (param === 'dedicated' && showDelivery) return 'dedicated';
  if (param === 'referred' && showCommercial) return 'referred';
  if (showDelivery) return 'dedicated';
  return 'referred';
}

function DedicatedTab({
  stores,
  onOpenHub,
}: {
  stores: DedicatedHomeStore[];
  onOpenHub: (segment: 'stores' | 'opportunities') => void;
}) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ marginHorizontal: -spacing.md }}>
        <DesignatedListSection />
      </View>
      <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t('agent.myBusinesses.dedicatedStoresTitle', 'Your dedicated stores')}
      </Text>
      {stores.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t(
            'agent.myBusinesses.dedicatedEmpty',
            'You are not a dedicated agent for any store yet. Browse openings to apply.'
          )}
        </Text>
      ) : (
        stores.map((store) => <StoreRow key={store.locationId} store={store} />)
      )}
      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => onOpenHub('opportunities')} style={styles.actionBtn}>
          {t('agent.myBusinesses.browseOpportunities', 'Browse opportunities')}
        </Button>
        <Button mode="contained" onPress={() => onOpenHub('stores')} style={styles.actionBtn}>
          {t('agent.myBusinesses.manageStores', 'Manage stores')}
        </Button>
      </View>
      <Pressable
        onPress={() => onOpenHub('stores')}
        style={[
          styles.linkRow,
          { borderColor: colors.divider, borderRadius: borderRadius.md, backgroundColor: colors.surface },
        ]}
      >
        <MaterialCommunityIcons name="storefront-outline" size={20} color={colors.primary.main} />
        <Text variant="bodyMedium" style={{ flex: 1, color: colors.text.primary }}>
          {t('agent.myBusinesses.openDedicatedHub', 'Open dedicated hub')}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text.secondary} />
      </Pressable>
    </View>
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
  actions: { gap: spacing.sm },
  actionBtn: { alignSelf: 'stretch' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
  },
});
