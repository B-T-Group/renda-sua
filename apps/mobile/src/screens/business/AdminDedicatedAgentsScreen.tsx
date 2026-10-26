import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, SegmentedButtons, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermission } from '../../hooks/usePermissions';
import { useProfileMe } from '../../hooks/useProfileMe';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useAdminDedicatedAgentsCapability } from '../../hooks/useAdminDedicatedAgentsCapability';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { AppButton } from '../../components/common/AppButton';
import { AppTextInput } from '../../components/common/AppTextInput';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { SectionCard } from '../../components/common/SectionCard';
import { AdminDedicatedAssignModal } from '../../components/admin/AdminDedicatedAssignModal';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import { dedicatedAgentsAnalytics, type DedicatedAgentsPlatform } from '../../services/dedicatedAgentsAnalytics';
import {
  ADMIN_SLOT_KEYS,
  agentFullName,
  buildAdminAssignmentFilters,
  isAdminFeatureOff,
  mapAdminActionError,
  nextAssignmentStatus,
  showRelationWarning,
  type AdminSlotFilter,
  type AdminStatusFilter,
} from '../../utils/adminDedicatedAssign';
import type { AdminAssignmentView } from '../../types/dedicatedAgents';

const analyticsPlatform: DedicatedAgentsPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

/**
 * Admin (platform.manage.agents): list dedicated-agent assignments across stores,
 * pause / resume / remove them, and assign an agent to a store's slots.
 * Mirrors the web Manage agents > Dedicated tab.
 */
export default function AdminDedicatedAgentsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();
  const { me, loading: profileLoading } = useProfileMe();
  const canManage = usePermission(PlatformPermissions.MANAGE_AGENTS, me);
  const { capability, loading: capabilityLoading, visible } = useAdminDedicatedAgentsCapability(canManage);

  const [assignments, setAssignments] = useState<AdminAssignmentView[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [featureOff, setFeatureOff] = useState(false);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [slotFilter, setSlotFilter] = useState<AdminSlotFilter>('all');
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>('all');
  const [city, setCity] = useState('');
  const [appliedCity, setAppliedCity] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const loadSeq = useRef(0);
  const viewedRef = useRef(false);

  // Debounce the city filter so each keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => setAppliedCity(city), 400);
    return () => clearTimeout(timer);
  }, [city]);

  const load = useCallback(
    async (opts?: { pull?: boolean }) => {
      const seq = ++loadSeq.current;
      if (opts?.pull) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        const res = await dedicatedAgentsService.getAdminAssignments(
          buildAdminAssignmentFilters({ city: appliedCity, slot: slotFilter, status: statusFilter })
        );
        if (seq !== loadSeq.current) return;
        setAssignments(res.assignments ?? []);
        if (!viewedRef.current) {
          viewedRef.current = true;
          dedicatedAgentsAnalytics.sectionViewed({
            platform: analyticsPlatform,
            role: 'admin',
            slotsEnabled: 0,
            agents: res.assignments?.length ?? 0,
            openPostings: 0,
          });
        }
        setTruncated(res.truncated === true);
        setFeatureOff(false);
      } catch (err: unknown) {
        if (seq !== loadSeq.current) return;
        if (isAdminFeatureOff(err)) {
          setFeatureOff(true);
        } else {
          setLoadError(mapAdminActionError(err).key);
        }
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [appliedCity, slotFilter, statusFilter]
  );

  useEffect(() => {
    if (canManage && visible) void load();
  }, [canManage, visible, load]);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (busyIds.has(id)) return;
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const reportActionError = (err: unknown, endpoint: string) => {
    const mapped = mapAdminActionError(err);
    Alert.alert(t('common.error', 'Error'), t(mapped.key, mapped.defaultMessage));
    const code = (err as { code?: string })?.code;
    if (code) dedicatedAgentsAnalytics.actionConflict({ platform: analyticsPlatform, role: 'admin', endpoint, code });
    if (mapped.reload) void load({ pull: true });
  };

  const togglePause = (a: AdminAssignmentView) =>
    withBusy(a.assignmentId, async () => {
      const status = nextAssignmentStatus(a.status);
      try {
        await dedicatedAgentsService.updateAdminAssignment(a.assignmentId, { status });
        const base = { platform: analyticsPlatform, role: 'admin' as const, slotKey: a.slotKey, isInternal: a.agent.isInternal };
        if (status === 'paused') dedicatedAgentsAnalytics.agentPaused(base);
        else dedicatedAgentsAnalytics.agentResumed(base);
        await load({ pull: true });
      } catch (err: unknown) {
        reportActionError(err, 'updateAdminAssignment');
      }
    });

  const remove = (a: AdminAssignmentView) =>
    withBusy(a.assignmentId, async () => {
      try {
        await dedicatedAgentsService.deleteAdminAssignment(a.assignmentId);
        dedicatedAgentsAnalytics.agentRemoved({
          platform: analyticsPlatform,
          role: 'admin',
          slotKey: a.slotKey,
          isInternal: a.agent.isInternal,
        });
        await load({ pull: true });
      } catch (err: unknown) {
        reportActionError(err, 'deleteAdminAssignment');
      }
    });

  const confirmRemove = (a: AdminAssignmentView) => {
    Alert.alert(
      t('dedicatedAgents.superuser.removeConfirm', 'Remove assignment?'),
      t('dedicatedAgents.superuser.removeConfirmDetail', {
        defaultValue: 'Remove {{name}} from {{store}} ({{slot}})? The agent will no longer be dedicated to this store slot.',
        name: agentFullName(a.agent),
        store: a.location.name,
        slot: t(`dedicatedAgents.slots.${a.slotKey}`, a.slotKey),
      }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('dedicatedAgents.actions.remove', 'Remove'),
          style: 'destructive',
          onPress: () => void remove(a),
        },
      ]
    );
  };

  if (profileLoading || (canManage && capabilityLoading)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!canManage) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground, padding: spacing.lg }]}>
        <Text variant="titleMedium" style={{ color: colors.text.primary, textAlign: 'center' }}>
          {t('admin.dedicatedAgents.accessDenied', 'You do not have permission to manage dedicated agents.')}
        </Text>
      </View>
    );
  }

  if (!visible || featureOff) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <EmptyState
          title={t('admin.dedicatedAgents.unavailableTitle', 'Dedicated agents is not enabled')}
          body={
            capability === null
              ? t('admin.dedicatedAgents.unavailableLoadFailed', 'Could not check availability. Try again later.')
              : t('admin.dedicatedAgents.unavailableBody', 'Dedicated agents is not turned on for any country in your scope.')
          }
        />
      </View>
    );
  }

  const header = (
    <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
      {isOffline ? (
        <NoticeBanner tone="warning" message={t('dedicatedAgents.offline', 'Offline · showing last update')} />
      ) : null}
      {notice ? (
        <NoticeBanner
          tone="success"
          message={notice}
          actionLabel={t('common.dismiss', 'Dismiss')}
          onAction={() => setNotice(null)}
        />
      ) : null}
      <AppButton
        label={t('dedicatedAgents.superuser.assign', 'Assign')}
        icon="account-plus-outline"
        onPress={() => setAssignOpen(true)}
        disabled={isOffline}
      />
      <AppTextInput
        label={t('common.city', 'City')}
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
        autoCorrect={false}
        leadingIcon="map-marker-outline"
      />
      <SegmentedButtons
        value={slotFilter}
        onValueChange={(v) => setSlotFilter(v as AdminSlotFilter)}
        buttons={[
          { value: 'all', label: t('common.all', 'All') },
          ...ADMIN_SLOT_KEYS.map((s) => ({ value: s, label: t(`dedicatedAgents.slots.${s}`, s) })),
        ]}
        density="small"
      />
      <SegmentedButtons
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as AdminStatusFilter)}
        buttons={[
          { value: 'all', label: t('common.all', 'All') },
          { value: 'active', label: t('dedicatedAgents.chips.status.active', 'Active') },
          { value: 'paused', label: t('dedicatedAgents.chips.status.paused', 'Paused') },
        ]}
        density="small"
      />
      {truncated ? (
        <NoticeBanner
          tone="info"
          message={t('dedicatedAgents.admin.truncated', 'Showing the first results; refine the search')}
        />
      ) : null}
    </View>
  );

  const renderItem = ({ item: a }: { item: AdminAssignmentView }) => {
    const busy = busyIds.has(a.assignmentId);
    const paused = a.status === 'paused';
    const actionLabel = paused
      ? t('dedicatedAgents.actions.resume', 'Resume')
      : t('dedicatedAgents.actions.pause', 'Pause');
    return (
      <SectionCard style={{ marginBottom: spacing.sm }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.subheading, { color: colors.text.primary }]}>
            {agentFullName(a.agent) || t('dedicatedAgents.admin.unnamedAgent', 'Agent')}
          </Text>
          <View style={styles.badges}>
            <Badge
              tone="neutral"
              label={
                a.agent.isInternal
                  ? t('dedicatedAgents.chips.type.internal', 'Internal')
                  : t('dedicatedAgents.chips.type.independent', 'Independent')
              }
            />
            <Badge tone="primary" label={t(`dedicatedAgents.slots.${a.slotKey}`, a.slotKey)} />
            <Badge
              tone={paused ? 'warning' : 'success'}
              label={
                paused
                  ? t('dedicatedAgents.chips.status.paused', 'Paused')
                  : t('dedicatedAgents.chips.status.active', 'Active')
              }
            />
            {showRelationWarning(a) ? (
              <Badge
                tone="warning"
                label={t('dedicatedAgents.superuser.relationWarning', 'Agent may be related to this business')}
              />
            ) : null}
          </View>
          <Text style={[typography.body2, { color: colors.text.primary }]}>{a.location.businessName}</Text>
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            {[a.location.name, a.location.city].filter(Boolean).join(' · ')}
          </Text>
          <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.xs }]}>
            <AppButton
              label={actionLabel}
              variant="outline"
              size="small"
              icon={paused ? 'play-outline' : 'pause'}
              loading={busy}
              disabled={isOffline}
              onPress={() => void togglePause(a)}
              style={styles.actionBtn}
            />
            <AppButton
              label={t('dedicatedAgents.actions.remove', 'Remove')}
              variant="danger"
              size="small"
              icon="delete-outline"
              disabled={isOffline || busy}
              onPress={() => confirmRemove(a)}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </SectionCard>
    );
  };

  let empty: React.ReactElement | null = null;
  if (loading && assignments.length === 0) {
    empty = <ActivityIndicator style={{ marginTop: spacing.lg }} />;
  } else if (loadError) {
    empty = (
      <ErrorState
        title={t(loadError, 'Something went wrong')}
        actionLabel={t('dedicatedAgents.retry', 'Retry')}
        onRetry={() => void load()}
      />
    );
  } else if (assignments.length === 0) {
    empty = (
      <EmptyState
        title={t('dedicatedAgents.superuser.noAssignments', 'No assignments found.')}
        body={t('admin.dedicatedAgents.emptyBody', 'Assign an agent to a store slot to get started.')}
        actionLabel={isOffline ? undefined : t('dedicatedAgents.superuser.assign', 'Assign')}
        onAction={() => setAssignOpen(true)}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <FlatList
        data={loadError ? [] : assignments}
        keyExtractor={(a) => a.assignmentId}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ pull: true })} />}
        keyboardShouldPersistTaps="handled"
      />
      <AdminDedicatedAssignModal
        visible={assignOpen}
        offline={isOffline}
        onDismiss={() => setAssignOpen(false)}
        onAssigned={() => {
          setNotice(t('dedicatedAgents.admin.assigned', 'Assigned. The store and agent were notified.'));
          void load({ pull: true });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row' },
  actionBtn: { flex: 1 },
});
